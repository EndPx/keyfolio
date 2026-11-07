// NEAR sandbox tests (KF-05d). Unix-only: near-workspaces downloads and runs
// a local sandbox node that does not support Windows hosts (CAP07); run via
// WSL/Linux/CI from the same source tree.
//
// These tests drive the DEPLOYED wasm through real transactions: real
// receipts, real promise callbacks and real storage accounting - the parts
// host unit tests cannot cover (N08 callback path, N01 storage/mint).

#![cfg(unix)]

use near_workspaces::types::NearToken;
use near_workspaces::{network::Sandbox, Worker};

const WASM_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/target/wasm32-unknown-unknown/release/access.wasm"
);

struct Env {
    worker: Worker<Sandbox>,
    contract: near_workspaces::Contract,
    owner: near_workspaces::Account,
    monitor: near_workspaces::Account,
    ft: near_workspaces::Account,
    buyer: near_workspaces::Account,
    trader: near_workspaces::Account,
}

async fn setup() -> Env {
    let worker = near_workspaces::sandbox().await.expect("sandbox start");
    let wasm = std::fs::read(WASM_PATH).expect("build the wasm first: cargo build --target wasm32-unknown-unknown");
    let contract = worker.dev_deploy(&wasm).await.expect("deploy");

    let owner = worker.dev_create_account().await.expect("owner");
    let monitor = worker.dev_create_account().await.expect("monitor");
    let ft = worker.dev_create_account().await.expect("ft");
    let buyer = worker.dev_create_account().await.expect("buyer");
    let trader = worker.dev_create_account().await.expect("trader");

    contract
        .call("new")
        .args_json(serde_json::json!({
            "owner_id": owner.id(),
            "monitor_id": monitor.id(),
            "ft_id": ft.id(),
        }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    // Publish the F-VEST plan: 101 atomic over a 10-second term.
    owner
        .call(contract.id(), "set_plan")
        .args_json(serde_json::json!({
            "trader_id": trader.id(),
            "version": 1,
            "price": "101",
            "term_ms": 10_000u64,
        }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    // Buyer prepays storage (separate from the FT price).
    buyer
        .call(contract.id(), "storage_deposit")
        .args_json(serde_json::json!({ "account_id": null }))
        .deposit(NearToken::from_near(1))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    Env { worker, contract, owner, monitor, ft, buyer, trader }
}

async fn purchase(env: &Env, purchase_id: &str, amount: &str) -> String {
    env.ft
        .call(env.contract.id(), "ft_on_transfer")
        .args_json(serde_json::json!({
            "sender_id": env.buyer.id(),
            "amount": amount,
            "msg": serde_json::json!({
                "action": "purchase",
                "trader_id": env.trader.id(),
                "plan_version": 1,
                "purchase_id": purchase_id,
            })
            .to_string(),
        }))
        .transact()
        .await
        .unwrap()
        .json::<String>()
        .unwrap()
}

#[tokio::test]
async fn n01_exact_payment_mints_license_and_tranche() {
    let env = setup().await;
    let returned = purchase(&env, "ord-1", "101").await;
    assert_eq!(returned, "0", "exact payment accepts everything");

    let token: serde_json::Value = env
        .contract
        .call("nft_token")
        .args_json(serde_json::json!({ "token_id": format!("kf-{}-{}-ord-1", env.trader.id(), env.buyer.id()) }))
        .view()
        .await
        .unwrap()
        .json().unwrap();
    assert_eq!(token["owner_id"], serde_json::json!(env.buyer.id()), "NFT minted to buyer");

    let license: serde_json::Value = env
        .contract
        .call("get_license")
        .args_json(serde_json::json!({ "token_id": format!("kf-{}-{}-ord-1", env.trader.id(), env.buyer.id()) }))
        .view()
        .await
        .unwrap()
        .json().unwrap();
    assert_eq!(license["access_epoch"], 1);
    assert_eq!(license["access_active"], true);

    // Storage slot consumed: measured usage must fit the buffer we promise.
    let balance: String = env
        .contract
        .call("storage_balance_of")
        .args_json(serde_json::json!({ "account_id": env.buyer.id() }))
        .view()
        .await
        .unwrap()
        .json().unwrap();
    let paid: u128 = NearToken::from_near(1).as_yoctonear();
    let min: u128 = env
        .contract
        .call("storage_minimum_balance")
        .view()
        .await
        .unwrap()
        .json().unwrap();
    assert_eq!(balance.parse::<u128>().unwrap(), paid - min, "exactly one slot deducted");
}

#[tokio::test]
async fn n02_wrong_amount_is_refunded_without_minting() {
    let env = setup().await;
    let returned = purchase(&env, "ord-2", "102").await;
    assert_eq!(returned, "102", "mismatch returns the full amount");
    let license: Option<serde_json::Value> = env
        .contract
        .call("get_license")
        .args_json(serde_json::json!({ "token_id": format!("kf-{}-{}-ord-2", env.trader.id(), env.buyer.id()) }))
        .view()
        .await
        .unwrap()
        .json().unwrap();
    assert!(license.is_none(), "nothing minted");
}

#[tokio::test]
async fn n06_termination_freezes_and_payout_failure_restores_on_chain() {
    let env = setup().await;
    assert_eq!(purchase(&env, "ord-3", "101").await, "0");

    // Half the term: F-VEST says earned 50, unvested 51.
    env.worker.fast_forward(15).await.unwrap();

    env.monitor
        .call(env.contract.id(), "terminate_service")
        .args_json(serde_json::json!({ "trader_id": env.trader.id(), "reason": "outage" }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    let claimable: String = env
        .contract
        .call("claimable_of")
        .args_json(serde_json::json!({ "trader_id": env.trader.id() }))
        .view()
        .await
        .unwrap()
        .json().unwrap();
    let claimable: u128 = claimable.parse().unwrap();
    let vested_at_cutoff = claimable;
    assert!(
        claimable >= 1 && claimable <= 101,
        "partially vested at the real cutoff (block timing is not deterministic; exact F-VEST values are covered by host tests)"
    );

    // Trader withdraws: the reserved amount goes into `withdrawn` and the FT
    // transfer promise FAILS (the ft account has no ft_transfer), so the
    // private callback must restore the reservation on-chain.
    env.trader
        .call(env.contract.id(), "ft_withdraw")
        .args_json(serde_json::json!({ "amount": null }))
        .gas(near_workspaces::types::Gas::from_tgas(200))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();

    env.worker.fast_forward(3).await.unwrap();
    let claimable: String = env
        .contract
        .call("claimable_of")
        .args_json(serde_json::json!({ "trader_id": env.trader.id() }))
        .view()
        .await
        .unwrap()
        .json().unwrap();
    let claimable: u128 = claimable.parse().unwrap();
    assert_eq!(claimable, vested_at_cutoff, "failed payout restored by the on-chain callback");

    let tranches: serde_json::Value = env
        .contract
        .call("get_token_tranches")
        .args_json(serde_json::json!({ "token_id": format!("kf-{}-{}-ord-3", env.trader.id(), env.buyer.id()) }))
        .view()
        .await
        .unwrap()
        .json().unwrap();
    assert_eq!(tranches[0]["withdrawn"], serde_json::json!("0"), "reservation restored once");

    // Owner refund claim: real async flow with transfer lock (N07/N12 shape).
    env.buyer
        .call(env.contract.id(), "claim_refund")
        .args_json(serde_json::json!({ "token_id": format!("kf-{}-{}-ord-3", env.trader.id(), env.buyer.id()) }))
        .gas(near_workspaces::types::Gas::from_tgas(200))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();
    env.worker.fast_forward(3).await.unwrap();
    let refundable: String = env
        .contract
        .call("refundable_of")
        .args_json(serde_json::json!({ "token_id": format!("kf-{}-{}-ord-3", env.trader.id(), env.buyer.id()) }))
        .view()
        .await
        .unwrap()
        .json().unwrap();
    // The refund payout also targets the FT-less account, fails, and the
    // callback restores the reservation once more: refundable returns to the
    // exact complement of the frozen vested amount.
    assert_eq!(
        refundable.parse::<u128>().unwrap(),
        101 - vested_at_cutoff,
        "exact complement relation holds after a failed refund payout"
    );
}
