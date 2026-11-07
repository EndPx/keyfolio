// Sandbox FT integration (G02): deploy BOTH contracts to a real sandbox
// node and walk the full happy path with balance reconciliation:
//   init both -> register buyer + access on the FT -> fund buyer ->
//   ft_transfer_call purchase (real resolver) -> mint/tranche/deltas ->
//   payout SUCCESS on a real FT -> termination -> positive refund ->
//   balance reconciliation -> double-init rejection on both (T7).
// Unix-only (sandbox binary); exact F-VEST numbers stay in host tests.

#![cfg(unix)]

use near_workspaces::types::NearToken;

const ACCESS_WASM: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/target/wasm32-unknown-unknown/release/access.wasm"
);
const FT_WASM: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/target/wasm32-unknown-unknown/release/mock_ft.wasm"
);

fn read_wasm(env_key: &str, default_path: &str) -> Vec<u8> {
    let path = std::env::var(env_key).unwrap_or_else(|_| default_path.to_string());
    let bytes = std::fs::read(&path)
        .unwrap_or_else(|e| panic!("read wasm at {path}: {e} — build with cargo build --release --target wasm32-unknown-unknown"));
    assert!(bytes.len() < 4 * 1024 * 1024, "release wasm must be deployable");
    bytes
}

#[tokio::test]
async fn ft_integration_happy_path_with_reconciliation() {
    let worker = near_workspaces::sandbox().await.expect("sandbox");
    let access_wasm = read_wasm("ACCESS_WASM", ACCESS_WASM);
    let ft_wasm = read_wasm("FT_WASM", FT_WASM);

    let access = worker.dev_deploy(&access_wasm).await.expect("deploy access");
    let ft = worker.dev_deploy(&ft_wasm).await.expect("deploy mock ft");
    let owner = worker.dev_create_account().await.expect("owner/trader");
    let monitor = worker.dev_create_account().await.expect("monitor");
    let buyer = worker.dev_create_account().await.expect("buyer");

    // ---- init both contracts --------------------------------------------
    access
        .call("new")
        .args_json(serde_json::json!({
            "owner_id": owner.id(), "monitor_id": monitor.id(), "ft_id": ft.id(),
        }))
        .transact().await.unwrap().into_result().unwrap();
    ft.call("new")
        .args_json(serde_json::json!({ "owner_id": owner.id(), "total_supply": "1000000000000" }))
        .transact().await.unwrap().into_result().unwrap();

    // T1 definitive export check: metadata + total supply respond.
    let md: serde_json::Value = ft.view("ft_metadata").await.unwrap().json().unwrap();
    assert!(md["name"].as_str().unwrap().contains("TEST"), "mock FT must label itself TEST");
    let supply: String = ft.view("ft_total_supply").await.unwrap().json().unwrap();
    assert_eq!(supply, "1000000000000");

    // T7: double init must be rejected ON THE DEPLOYED WASM, both contracts.
    let again = access
        .call("new")
        .args_json(serde_json::json!({
            "owner_id": owner.id(), "monitor_id": monitor.id(), "ft_id": ft.id(),
        }))
        .transact().await.unwrap();
    assert!(again.is_failure(), "second access init must fail");
    let again_ft = ft
        .call("new")
        .args_json(serde_json::json!({ "owner_id": owner.id(), "total_supply": "1" }))
        .transact().await.unwrap();
    assert!(again_ft.is_failure(), "second FT init must fail");

    // ---- register receivers on the FT (buyer + the ACCESS contract) ------
    buyer
        .call(ft.id(), "storage_deposit")
        .args_json(serde_json::json!({ "account_id": buyer.id() }))
        .deposit(NearToken::from_near(1))
        .transact().await.unwrap().into_result().unwrap();
    buyer
        .call(ft.id(), "storage_deposit")
        .args_json(serde_json::json!({ "account_id": access.id() }))
        .deposit(NearToken::from_near(1))
        .transact().await.unwrap().into_result().unwrap();

    // Fund the buyer 10,000 tokens.
    owner
        .call(ft.id(), "ft_transfer")
        .args_json(serde_json::json!({ "receiver_id": buyer.id(), "amount": "10000" }))
        .deposit(NearToken::from_yoctonear(1))
        .transact().await.unwrap().into_result().unwrap();

    // Buyer prepays storage on the access contract.
    buyer
        .call(access.id(), "storage_deposit")
        .args_json(serde_json::json!({ "account_id": buyer.id() }))
        .deposit(NearToken::from_near(1))
        .transact().await.unwrap().into_result().unwrap();

    // F-VEST plan: 101 atomic over 10 seconds.
    owner
        .call(access.id(), "set_plan")
        .args_json(serde_json::json!({ "trader_id": owner.id(), "version": 1, "price": "101", "term_ms": 10_000u64 }))
        .transact().await.unwrap().into_result().unwrap();

    let ft_bal = |who: near_workspaces::AccountId| {
        let ft = &ft;
        async move {
            let s: String = ft.view("ft_balance_of").args_json(serde_json::json!({ "account_id": who })).await.unwrap().json().unwrap();
            s.parse::<u128>().unwrap()
        }
    };
    let buyer_before = ft_bal(buyer.id().clone()).await;
    let access_before = ft_bal(access.id().clone()).await;
    let owner_before = ft_bal(owner.id().clone()).await;

    // ---- purchase via REAL ft_transfer_call (resolver path) --------------
    async fn purchase(
        access: &near_workspaces::Contract,
        ft: &near_workspaces::Contract,
        who: &near_workspaces::Account,
        owner_id: &near_workspaces::AccountId,
        purchase_id: &str,
    ) -> String {
        let buyer_id = who.id().clone();
        let owner_id = owner_id.clone();
            let out = who
                .call(ft.id(), "ft_transfer_call")
                .args_json(serde_json::json!({
                    "receiver_id": access.id(),
                    "amount": "101",
                    "memo": format!("purchase {purchase_id}"),
                    "msg": serde_json::json!({
                        "action": "purchase",
                        "trader_id": owner_id,
                        "plan_version": 1,
                        "purchase_id": purchase_id,
                    }).to_string(),
                }))
                .deposit(NearToken::from_yoctonear(1))
                .gas(near_workspaces::types::Gas::from_tgas(250))
                .transact().await.unwrap();
            assert!(out.is_success(), "purchase {purchase_id} failed: {:?}", out.failures());
            // NEP-141: ft_resolve_transfer returns the amount SPENT by the
            // receiver, not the unused amount (neps/nep-0141.md). Full
            // acceptance of 101 -> the result is exactly "101".
            let resolver: String = out.clone().json().unwrap();
            if resolver != "101" {
                panic!(
                    "resolver returned {resolver} for {purchase_id}; expected the spent amount 101. Receipts: {:#?}",
                    out.receipt_outcomes()
                );
            }
            let tid = format!("kf-{}-{}-{purchase_id}", owner_id, buyer_id);
            let lic: serde_json::Value = access.view("get_license").args_json(serde_json::json!({ "token_id": tid })).await.unwrap().json().unwrap();
            assert_eq!(lic["owner_id"], serde_json::json!(buyer_id), "license minted to buyer");
            assert_eq!(lic["access_active"], true);
            let tranches: serde_json::Value = access.view("get_token_tranches").args_json(serde_json::json!({ "token_id": tid })).await.unwrap().json().unwrap();
            assert_eq!(tranches.as_array().unwrap().len(), 1, "one billing tranche");
            assert_eq!(tranches[0]["gross"], serde_json::json!("101"));
            tid
    }
    let tid1 = purchase(&access, &ft, &buyer, owner.id(), "ft-ord-1").await;
    assert_eq!(ft_bal(buyer.id().clone()).await, buyer_before - 101, "buyer delta -101");
    assert_eq!(ft_bal(access.id().clone()).await, access_before + 101, "access delta +101");

    // ---- full term passes; trader withdraws via the REAL FT (SUCCESS) ----
    // Sandbox block timing varies: advance in bursts until fully vested
    // (bounded retries; the exact F-VEST numbers live in host tests).
    let mut claimable = String::new();
    for _ in 0..20 {
        worker.fast_forward(10).await.unwrap();
        claimable = access
            .view("claimable_of")
            .args_json(serde_json::json!({ "trader_id": owner.id() }))
            .await
            .unwrap()
            .json()
            .unwrap();
        if claimable == "101" {
            break;
        }
    }
    assert_eq!(claimable, "101", "fully vested after the term");

    let out = owner
        .call(access.id(), "ft_withdraw")
        .args_json(serde_json::json!({ "amount": null }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(near_workspaces::types::Gas::from_tgas(250))
        .transact().await.unwrap();
    assert!(out.is_success(), "withdraw failed: {:?}", out.failures());
    let settled = out.receipt_outcomes().iter().any(|r| r.logs.iter().any(|l| l.contains("payout_settled")));
    assert!(settled, "payout_settled callback log missing on the real FT path");
    assert_eq!(ft_bal(owner.id().clone()).await, owner_before + 101, "owner received the exact payout");
    assert_eq!(ft_bal(access.id().clone()).await, access_before + 101 - 101, "access paid out exactly");
    let claimable: String = access.view("claimable_of").args_json(serde_json::json!({ "trader_id": owner.id() })).await.unwrap().json().unwrap();
    assert_eq!(claimable, "0", "claimable drained by the settled payout");

    // ---- purchase #2, terminated mid-term, POSITIVE refund required ------
    let tid2 = purchase(&access, &ft, &buyer, owner.id(), "ft-ord-2").await;
    monitor
        .call(access.id(), "terminate_service")
        .args_json(serde_json::json!({ "trader_id": owner.id(), "reason": "sandbox refund test" }))
        .transact().await.unwrap().into_result().unwrap();
    let refundable_s: String = access.view("refundable_of").args_json(serde_json::json!({ "token_id": tid2 })).await.unwrap().json().unwrap();
    let refundable: u128 = refundable_s.parse().unwrap();
    assert!(refundable > 0, "mid-term termination must leave a POSITIVE refund; got {refundable} (failing loudly)");
    assert!(refundable < 101, "partial vesting must reduce the refund below the price");

    let buyer_pre_refund = ft_bal(buyer.id().clone()).await;
    let out = buyer
        .call(access.id(), "claim_refund")
        .args_json(serde_json::json!({ "token_id": tid2 }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(near_workspaces::types::Gas::from_tgas(250))
        .transact().await.unwrap();
    assert!(out.is_success(), "refund claim failed: {:?}", out.failures());
    let settled = out.receipt_outcomes().iter().any(|r| r.logs.iter().any(|l| l.contains("payout_settled")));
    assert!(settled, "refund payout_settled log missing");
    assert_eq!(ft_bal(buyer.id().clone()).await, buyer_pre_refund + refundable, "buyer received the exact refund");
    let refundable_after: String = access.view("refundable_of").args_json(serde_json::json!({ "token_id": tid2 })).await.unwrap().json().unwrap();
    assert_eq!(refundable_after, "0", "refundable drained by the settled refund");

    // Total conservation: FT supply unchanged across the whole flow.
    let supply: String = ft.view("ft_total_supply").await.unwrap().json().unwrap();
    assert_eq!(supply, "1000000000000", "token conservation");
}
