// Host-side unit tests for KF-05b purchase/renewal flows using the near-sdk
// testing environment (no sandbox, no network). Complementary sandbox tests
// (N01-N12) run under WSL/Linux in KF-05d.

use crate::*;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;

const FT: usize = 1;
const BUYER: usize = 2;
const TRADER: usize = 3;
const OWNER: usize = 5;
const MONITOR: usize = 4;

const PRICE: Balance = 25_000_000; // 25 USDC @ 6 decimals
const TERM_MS: u64 = 2_592_000_000; // 30 days
const T0_NS: u64 = 1_700_000_000_000_000_000;

fn set_ctx(predecessor: usize, at_ns: u64) {
    set_ctx_with_deposit(predecessor, at_ns, 0);
}

fn set_ctx_with_deposit(predecessor: usize, at_ns: u64, attached_yocto: u128) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(accounts(0))
        .predecessor_account_id(accounts(predecessor))
        .signer_account_id(accounts(predecessor))
        .attached_deposit(NearToken::from_yoctonear(attached_yocto))
        .block_timestamp(at_ns);
    testing_env!(b.build());
}

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

/// Prepay storage for `who` with the given whole-NEAR amount.
fn prep_storage(c: &mut AccessContract, who: usize, near_amount: u128) {
    set_ctx_with_deposit(who, T0_NS, near_amount * NEAR);
    c.storage_deposit(None);
}

fn fresh_contract() -> AccessContract {
    set_ctx(OWNER, T0_NS);
    AccessContract::new(accounts(OWNER), accounts(MONITOR), accounts(FT))
}

fn publish_default_plan(c: &mut AccessContract) {
    set_ctx(OWNER, T0_NS);
    c.set_plan(accounts(TRADER), 1, U128(PRICE), TERM_MS);
}

fn purchase_msg(trader: usize, version: u32, purchase_id: &str) -> String {
    near_sdk::serde_json::json!({
        "action": "purchase",
        "trader_id": accounts(trader).to_string(),
        "plan_version": version,
        "purchase_id": purchase_id,
    })
    .to_string()
}

fn renew_msg(token_id: &str) -> String {
    near_sdk::serde_json::json!({ "action": "renew", "token_id": token_id }).to_string()
}

fn token_id_for(trader: usize, purchase_id: &str) -> TokenId {
    format!("kf-{}-{}-{}", accounts(trader), accounts(BUYER), purchase_id)
}

#[test]
fn purchase_happy_path_mints_license_and_tranche() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    prep_storage(&mut c, BUYER, 1);
    set_ctx(FT, T0_NS);
    let res = c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "ord-1"));
    assert_eq!(res, U128(0), "exact payment accepts everything");

    let tid = token_id_for(TRADER, "ord-1");
    let lic = c.get_license(tid.clone()).expect("license minted");
    assert_eq!(lic.owner_id, accounts(BUYER));
    assert_eq!(lic.trader_id, accounts(TRADER));
    assert_eq!(lic.expires_at_ms, T0_NS / 1_000_000 + TERM_MS);
    assert_eq!(lic.access_epoch, 1);
    assert!(lic.access_active);

    let tranches = c.get_token_tranches(tid);
    assert_eq!(tranches.len(), 1);
    assert_eq!(tranches[0].gross, U128(PRICE));
    assert_eq!(tranches[0].start_ms, T0_NS / 1_000_000);
    assert_eq!(tranches[0].end_ms, T0_NS / 1_000_000 + TERM_MS);
    assert!(c.has_purchase(accounts(TRADER), accounts(BUYER), "ord-1".into()));
}

#[test]
fn wrong_amount_is_refunded_without_minting() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    set_ctx(FT, T0_NS);
    let res = c.ft_on_transfer(accounts(BUYER), U128(PRICE + 1), purchase_msg(TRADER, 1, "ord-2"));
    assert_eq!(res, U128(PRICE + 1), "exact-price model refunds any mismatch");
    assert!(c.get_license(token_id_for(TRADER, "ord-2")).is_none());
    assert!(!c.has_purchase(accounts(TRADER), accounts(BUYER), "ord-2".into()));
}

#[test]
fn replayed_purchase_id_is_refunded() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    set_ctx(FT, T0_NS);
    prep_storage(&mut c, BUYER, 1);
    set_ctx(FT, T0_NS);
    assert_eq!(
        c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "ord-3")),
        U128(0)
    );
    let again = c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "ord-3"));
    assert_eq!(again, U128(PRICE), "replayed purchase id returns funds");
    // Same id under a different payer is a different purchase (with own storage).
    prep_storage(&mut c, 0, 1);
    set_ctx(FT, T0_NS);
    let other = c.ft_on_transfer(accounts(0), U128(PRICE), purchase_msg(TRADER, 1, "ord-3"));
    assert_eq!(other, U128(0));
}

#[test]
fn sales_paused_and_unknown_trader_refund() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    set_ctx(OWNER, T0_NS);
    c.set_sales_enabled(accounts(TRADER), false);
    set_ctx(FT, T0_NS);
    let res = c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "ord-4"));
    assert_eq!(res, U128(PRICE));
    let res = c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(0, 1, "ord-4b"));
    assert_eq!(res, U128(PRICE), "unknown trader refunds");
}

#[test]
fn only_the_allowlisted_ft_may_call() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    set_ctx(BUYER, T0_NS); // wrong predecessor
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "ord-5"))
    }));
    assert!(result.is_err(), "non-FT predecessor must panic");
}

#[test]
fn unparsable_message_panics() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    set_ctx(FT, T0_NS);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.ft_on_transfer(accounts(BUYER), U128(PRICE), "not-json".into())
    }));
    assert!(result.is_err());
}

#[test]
fn renewal_extends_from_max_now_expiry() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    set_ctx(FT, T0_NS);
    prep_storage(&mut c, BUYER, 1);
    set_ctx(FT, T0_NS);
    c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "ord-6"));
    let tid = token_id_for(TRADER, "ord-6");
    let first_expiry = T0_NS / 1_000_000 + TERM_MS;

    // Renew mid-term: extends from the OLD expiry, not from now (D07/F-TIME).
    let mid = T0_NS + 5 * 86_400_000_000_000; // +5 days in ns
    set_ctx(FT, mid);
    assert_eq!(c.ft_on_transfer(accounts(BUYER), U128(PRICE), renew_msg(&tid)), U128(0));
    let lic = c.get_license(tid.clone()).unwrap();
    assert_eq!(lic.expires_at_ms, first_expiry + TERM_MS);

    // Renew after the (extended) expiry: starts at now (+1s past it).
    let second_expiry = first_expiry + TERM_MS;
    let after_ns: u128 = (u128::from(second_expiry) + 1_000) * 1_000_000; // +1s
    set_ctx(FT, after_ns as u64);
    assert_eq!(c.ft_on_transfer(accounts(BUYER), U128(PRICE), renew_msg(&tid)), U128(0));
    let lic = c.get_license(tid.clone()).unwrap();
    assert_eq!(lic.expires_at_ms, second_expiry + 1_000 + TERM_MS);

    // Three tranches (purchase + two renewals); purchased terms intact and
    // the mid-term renewal contiguous with the original term.
    let tranches = c.get_token_tranches(tid);
    assert_eq!(tranches.len(), 3);
    assert_eq!(tranches[0].end_ms, first_expiry);
    assert_eq!(tranches[1].start_ms, tranches[0].end_ms, "renewal mid-term starts at old expiry");
    assert_eq!(tranches[1].end_ms, first_expiry + TERM_MS);
    assert_eq!(tranches[2].start_ms, first_expiry + TERM_MS + 1_000);
}

#[test]
fn renewal_rules_owner_amount_and_unknown_token() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    set_ctx(FT, T0_NS);
    prep_storage(&mut c, BUYER, 1);
    set_ctx(FT, T0_NS);
    c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "ord-7"));
    let tid = token_id_for(TRADER, "ord-7");

    set_ctx(FT, T0_NS);
    assert_eq!(c.ft_on_transfer(accounts(0), U128(PRICE), renew_msg(&tid)), U128(PRICE), "non-owner");
    assert_eq!(
        c.ft_on_transfer(accounts(BUYER), U128(PRICE - 1), renew_msg(&tid)),
        U128(PRICE - 1),
        "wrong amount"
    );
    assert_eq!(c.ft_on_transfer(accounts(BUYER), U128(PRICE), renew_msg("missing")), U128(PRICE), "unknown token");
}

#[test]
fn plans_are_immutable_and_versions_advance() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    set_ctx(OWNER, T0_NS);
    // Identical re-publish is idempotent.
    c.set_plan(accounts(TRADER), 1, U128(PRICE), TERM_MS);
    // Changed terms on a published version are rejected.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.set_plan(accounts(TRADER), 1, U128(PRICE + 1), TERM_MS)
    }));
    assert!(result.is_err(), "published plans are immutable");
    // New version becomes current.
    c.set_plan(accounts(TRADER), 2, U128(PRICE + 5), TERM_MS);
    let trader = c.get_trader(accounts(TRADER)).unwrap();
    assert_eq!(trader.current_plan_version, 2);
    let plan = c.get_current_plan(accounts(TRADER)).unwrap();
    assert_eq!(plan.price, U128(PRICE + 5));
}

#[test]
fn plan_preconditions_enforced() {
    let mut c = fresh_contract();
    set_ctx(OWNER, T0_NS);
    let cases: [(U128, u64); 3] = [
        (U128(0), TERM_MS),
        (U128(PRICE), 0),
        (U128(PRICE), (vesting::MAX_TERM_MS + 1) as u64),
    ];
    for (price, term) in cases {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.set_plan(accounts(TRADER), 1, price, term)
        }));
        assert!(result.is_err(), "precondition must reject");
        set_ctx(OWNER, T0_NS);
    }
}

#[test]
fn vesting_integrates_with_contract_tranches() {
    let mut c = fresh_contract();
    // F-VEST price: 101 atomic over a 10-second term.
    set_ctx(OWNER, T0_NS);
    c.set_plan(accounts(TRADER), 1, U128(101), 10_000);
    set_ctx(FT, T0_NS);
    prep_storage(&mut c, BUYER, 1);
    set_ctx(FT, T0_NS);
    c.ft_on_transfer(accounts(BUYER), U128(101), purchase_msg(TRADER, 1, "ord-8"));
    let tid = token_id_for(TRADER, "ord-8");
    let mut tranches = c.get_token_tranches(tid);
    let t = tranches.remove(0);
    let (start, end) = (t.start_ms, t.end_ms);
    assert_eq!(vesting::earned_atomic(101, start as u128, end as u128, (start + 5_000) as u128), 50);
    assert_eq!(101 - 50, 51, "unvested remainder refundable at termination");
    assert_eq!(vesting::earned_atomic(101, start as u128, end as u128, end as u128), 101);
}



#[test]
fn purchase_without_prepaid_storage_is_refunded() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    // No storage_deposit call at all.
    set_ctx(FT, T0_NS);
    let res = c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "ord-9"));
    assert_eq!(res, U128(PRICE), "FT funds are refunded; storage is prepaid separately");
    assert!(c.get_license(token_id_for(TRADER, "ord-9")).is_none());
    assert_eq!(c.storage_balance_of(accounts(BUYER)), U128(0));
}

#[test]
fn storage_deposit_and_withdraw_account_correctly() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    set_ctx_with_deposit(BUYER, T0_NS, 2 * NEAR);
    let before = env::storage_usage();
    c.storage_deposit(None);
    let registration_cost = u128::from(env::storage_usage() - before) * env::storage_byte_cost().as_yoctonear();
    assert_eq!(c.storage_balance_of(accounts(BUYER)).0, 2 * NEAR - registration_cost);
    prep_storage(&mut c, BUYER, 1);
    set_ctx(FT, T0_NS);
    let before_mint = env::storage_usage();
    let credit_before = c.storage_balance_of(accounts(BUYER)).0;
    assert_eq!(c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "ord-10")), U128(0));
    let mint_cost = u128::from(env::storage_usage() - before_mint) * env::storage_byte_cost().as_yoctonear();
    assert_eq!(c.storage_balance_of(accounts(BUYER)).0, credit_before - mint_cost);
    set_ctx_with_deposit(BUYER, T0_NS, 1);
    assert_eq!(c.storage_withdraw(None), U128(0));
    let e = c.storage_balances.get(&accounts(BUYER)).unwrap();
    assert_eq!(e.pending, 3 * NEAR - registration_cost - mint_cost);
    c.settle_native_withdrawal(accounts(BUYER), e.nonce, true);
    assert_eq!(c.storage_balance_of(accounts(BUYER)).0, 0);
}

#[test]
fn trader_indices_and_earnings_are_independent() {
    let mut c = fresh_contract();
    set_ctx(OWNER, T0_NS);
    c.set_plan(accounts(TRADER), 1, U128(101), 10_000);
    c.set_plan(accounts(MONITOR), 1, U128(203), 10_000);
    prep_storage(&mut c, BUYER, 1);
    prep_storage(&mut c, 0, 1);
    set_ctx(FT, T0_NS);
    assert_eq!(c.ft_on_transfer(accounts(BUYER), U128(101), purchase_msg(TRADER, 1, "a")), U128(0));
    assert_eq!(c.ft_on_transfer(accounts(0), U128(203), purchase_msg(MONITOR, 1, "b")), U128(0));
    let a = format!("kf-{}-{}-a", accounts(TRADER), accounts(BUYER));
    let b = format!("kf-{}-{}-b", accounts(MONITOR), accounts(0));
    assert_eq!(c.trader_tokens.get(&accounts(TRADER)).unwrap().get(0), Some(a));
    assert_eq!(c.trader_tokens.get(&accounts(MONITOR)).unwrap().get(0), Some(b));
    set_ctx(FT, T0_NS + 5_000_000_000);
    assert_eq!(c.claimable_of(accounts(TRADER)), U128(50));
    assert_eq!(c.claimable_of(accounts(MONITOR)), U128(101));
}

#[test]
fn unused_credit_is_withdrawable_before_and_after_transfer() {
    use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    prep_storage(&mut c, BUYER, 3);
    set_ctx(FT, T0_NS);
    assert_eq!(c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "backing")), U128(0));
    let credit = c.storage_balance_of(accounts(BUYER)).0;
    set_ctx_with_deposit(BUYER, T0_NS, 1);
    assert_eq!(c.storage_withdraw(Some(U128(credit / 2))), U128(credit - credit / 2));
    let e = c.storage_balances.get(&accounts(BUYER)).unwrap();
    c.settle_native_withdrawal(accounts(BUYER), e.nonce, true);
    c.nft_transfer(accounts(0), token_id_for(TRADER, "backing"), None, None);
    assert_eq!(c.storage_withdraw(None), U128(0));
    let e = c.storage_balances.get(&accounts(BUYER)).unwrap();
    assert_eq!(e.pending, credit - credit / 2);
}

#[test]
fn native_withdraw_failure_restores_once_and_rejects_wrong_deposit() {
    use near_sdk::PromiseResult;
    let mut c = fresh_contract();
    prep_storage(&mut c, BUYER, 1);
    let original = c.storage_balance_of(accounts(BUYER)).0;
    for deposit in [0, 2] {
        set_ctx_with_deposit(BUYER, T0_NS, deposit);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.storage_withdraw(Some(U128(123))))).is_err());
    }
    set_ctx_with_deposit(BUYER, T0_NS, 1);
    assert_eq!(c.storage_withdraw(Some(U128(123))), U128(original - 123));
    let e = c.storage_balances.get(&accounts(BUYER)).unwrap();
    assert_eq!(e.available + e.pending, original);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.storage_withdraw(None))).is_err());
    let mut b = VMContextBuilder::new();
    b.current_account_id(accounts(0)).predecessor_account_id(accounts(0));
    testing_env!(b.build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(), vec![PromiseResult::Failed]);
    c.storage_withdraw_callback(accounts(BUYER), e.nonce);
    assert_eq!(c.storage_balance_of(accounts(BUYER)).0, original);
    assert_eq!(c.storage_balances.get(&accounts(BUYER)).unwrap().pending, 0);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.storage_withdraw_callback(accounts(BUYER), e.nonce))).is_err());
    assert_eq!(c.storage_balance_of(accounts(BUYER)).0, original);
}

#[test]
fn renewal_charges_exact_storage_growth() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    prep_storage(&mut c, BUYER, 1);
    set_ctx(FT, T0_NS);
    assert_eq!(c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, "renew-cost")), U128(0));
    let credit = c.storage_balance_of(accounts(BUYER)).0;
    let before = env::storage_usage();
    assert_eq!(c.ft_on_transfer(accounts(BUYER), U128(PRICE), renew_msg(&token_id_for(TRADER, "renew-cost"))), U128(0));
    let bytes = env::storage_usage() - before;
    assert!(bytes > 0);
    assert_eq!(credit - c.storage_balance_of(accounts(BUYER)).0, u128::from(bytes) * env::storage_byte_cost().as_yoctonear());
}

#[test]
fn purchase_id_bounds_fail_closed_before_mutation() {
    let mut c = fresh_contract();
    publish_default_plan(&mut c);
    prep_storage(&mut c, BUYER, 1);
    set_ctx(FT, T0_NS);
    let before = env::storage_usage();
    for id in ["".to_string(), "x".repeat(129), "bad|id".to_string()] {
        assert_eq!(c.ft_on_transfer(accounts(BUYER), U128(PRICE), purchase_msg(TRADER, 1, &id)), U128(PRICE));
        assert_eq!(env::storage_usage(), before);
    }
}
