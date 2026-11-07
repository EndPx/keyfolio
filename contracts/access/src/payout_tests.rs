// KF-05c host unit tests: termination freeze, async payout reserve/settle,
// refund flow with transfer lock, and NFT transfer epoch transitions. The
// real promise/callback path is exercised later by NEAR sandbox tests (N08).

use crate::*;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;

const FT: usize = 1; // bob
const BUYER: usize = 2; // charlie
const TRADER: usize = 3; // danny
const MONITOR: usize = 4; // eugene
const NEW_OWNER: usize = 0; // alice
const OWNER: usize = 5; // fargo

const PRICE: Balance = 25_000_000;
const F_VEST_PRICE: Balance = 101;
const TERM_MS: u64 = 2_592_000_000;
const SHORT_TERM_MS: u64 = 10_000;
const T0_NS: u64 = 1_700_000_000_000_000_000;
const T0_MS: u64 = 1_700_000_000_000;
const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

fn set_ctx(predecessor: usize, at_ms: u64) {
    set_ctx_full(predecessor, at_ms, 0);
}

fn set_ctx_full(predecessor: usize, at_ms: u64, attached: u128) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(accounts(0))
        .predecessor_account_id(accounts(predecessor))
        .signer_account_id(accounts(predecessor))
        .attached_deposit(NearToken::from_yoctonear(attached))
        .block_timestamp(at_ms as u64 * 1_000_000);
    testing_env!(b.build());
}

fn fresh() -> AccessContract {
    set_ctx(OWNER, T0_MS);
    AccessContract::new(accounts(OWNER), accounts(MONITOR), accounts(FT))
}

fn prep_storage(c: &mut AccessContract, who: usize) {
    set_ctx_full(who, T0_MS, NEAR);
    c.storage_deposit(None);
}

fn purchase(c: &mut AccessContract, purchase_id: &str, price: Balance, plan_version: u32) -> TokenId {
    set_ctx(FT, T0_MS);
    let msg = near_sdk::serde_json::json!({
        "action": "purchase",
        "trader_id": accounts(TRADER).to_string(),
        "plan_version": plan_version,
        "purchase_id": purchase_id,
    })
    .to_string();
    c.ft_on_transfer(accounts(BUYER), U128(price), msg);
    format!("kf-{}-{}-{}", accounts(TRADER), accounts(BUYER), purchase_id)
}

fn token_id_for(purchase_id: &str) -> TokenId {
    format!("kf-{}-{}-{}", accounts(TRADER), accounts(BUYER), purchase_id)
}

fn setup_short_term() -> (AccessContract, TokenId) {
    let mut c = fresh();
    set_ctx(OWNER, T0_MS);
    c.set_plan(accounts(TRADER), 1, U128(F_VEST_PRICE), SHORT_TERM_MS);
    prep_storage(&mut c, BUYER);
    let tid = purchase(&mut c, "ord-t", F_VEST_PRICE, 1);
    (c, tid)
}

#[test]
fn termination_sets_contract_cutoff_and_freezes_earnings() {
    let (mut c, tid) = setup_short_term();
    // +5s: half vested (F-VEST: earned 50, unvested 51).
    set_ctx(FT, T0_MS + 5_000);
    assert_eq!(c.claimable_of(accounts(TRADER)), U128(50));

    // Terminate by the monitor: cutoff is THIS block time (KF-D010).
    set_ctx(MONITOR, T0_MS + 5_000);
    c.terminate_service(accounts(TRADER), "24h outage".into());
    let trader = c.get_trader(accounts(TRADER)).unwrap();
    assert!(trader.terminated);
    assert_eq!(trader.terminated_at_ms, Some(T0_MS + 5_000));
    assert!(!trader.sales_enabled);

    // Earnings are frozen at the cutoff even as time advances.
    set_ctx(FT, T0_MS + 60_000);
    assert_eq!(c.claimable_of(accounts(TRADER)), U128(50), "frozen at cutoff");
    assert_eq!(c.refundable_of(tid), U128(51), "unvested remainder refundable");
}

#[test]
fn only_monitor_or_owner_may_terminate() {
    let (mut c, _tid) = setup_short_term();
    set_ctx(BUYER, T0_MS + 1_000);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.terminate_service(accounts(TRADER), "nope".into())
    }));
    assert!(result.is_err(), "traders/buyers cannot terminate");
}

#[test]
fn withdrawal_reserves_then_settles_once() {
    let (mut c, _tid) = setup_short_term();
    set_ctx(FT, T0_MS + 5_000);
    // Reserved before any external call: withdrawn jumps to 50 immediately.
    set_ctx_full(TRADER, T0_MS + 5_000, 1);
    c.ft_withdraw(None);
    assert_eq!(c.claimable_of(accounts(TRADER)), U128(0), "reserved upfront");
    let tranches = c.get_token_tranches(token_id_for("ord-t"));
    assert_eq!(tranches[0].withdrawn, U128(50));

    // Settle success: reservation gone, nothing changes.
    set_ctx(0, T0_MS + 5_000); // self-call context
    c.settle_payout("wd-1", true);
    assert_eq!(c.claimable_of(accounts(TRADER)), U128(0));
    let tranches = c.get_token_tranches(token_id_for("ord-t"));
    assert_eq!(tranches[0].withdrawn, U128(50));

    // A duplicate callback for a settled action must panic (once-only, N08).
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.settle_payout("wd-1", true)
    }));
    assert!(result.is_err(), "unknown payout action");
}

#[test]
fn failed_payout_restores_reservation_exactly_once() {
    let (mut c, _tid) = setup_short_term();
    set_ctx(FT, T0_MS + 5_000);
    set_ctx_full(TRADER, T0_MS + 5_000, 1);
    c.ft_withdraw(None);
    assert_eq!(c.claimable_of(accounts(TRADER)), U128(0));

    set_ctx(0, T0_MS + 5_000);
    c.settle_payout("wd-1", false); // FT transfer failed
    assert_eq!(c.claimable_of(accounts(TRADER)), U128(50), "restored once");
    let tranches = c.get_token_tranches(token_id_for("ord-t"));
    assert_eq!(tranches[0].withdrawn, U128(0));

    // Second restore attempt must not double-credit.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.settle_payout("wd-1", false)
    }));
    assert!(result.is_err());
    assert_eq!(c.claimable_of(accounts(TRADER)), U128(50));
}

#[test]
fn refund_claim_locks_transfers_until_settled() {
    let (mut c, tid) = setup_short_term();
    set_ctx(MONITOR, T0_MS + 5_000);
    c.terminate_service(accounts(TRADER), "outage".into());

    // Non-owner cannot claim.
    set_ctx_full(NEW_OWNER, T0_MS + 6_000, 1);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.claim_refund(tid.clone())
    }));
    assert!(result.is_err(), "only the current NFT owner claims");

    // Owner claims: unvested 51 reserved into `refunded`, token locked.
    set_ctx_full(BUYER, T0_MS + 6_000, 1);
    c.claim_refund(tid.clone());
    assert_eq!(c.refundable_of(tid.clone()), U128(0), "reserved upfront");
    let tranches = c.get_token_tranches(tid.clone());
    assert_eq!(tranches[0].refunded, U128(51));

    // Transfer locked while refund pending.
    set_ctx(BUYER, T0_MS + 6_000);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        NonFungibleTokenCore::nft_transfer(
            &mut c,
            accounts(NEW_OWNER),
            tid.clone(),
            None,
            None,
        )
    }));
    assert!(result.is_err(), "refund pending: transfer locked");

    // Settle success: lock clears; refundable stays 0; second claim panics.
    set_ctx(0, T0_MS + 6_000);
    c.settle_payout("rf-1", true);
    set_ctx(BUYER, T0_MS + 6_000);
    NonFungibleTokenCore::nft_transfer(
        &mut c,
        accounts(NEW_OWNER),
        tid.clone(),
        None,
        None,
    ); // no longer locked
    let lic = c.get_license(tid.clone()).unwrap();
    assert_eq!(lic.owner_id, accounts(NEW_OWNER));

    set_ctx_full(NEW_OWNER, T0_MS + 6_000, 1);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.claim_refund(tid.clone())
    }));
    assert!(result.is_err(), "nothing unvested to refund");
}

#[test]
fn failed_refund_restores_and_unlocks() {
    let (mut c, tid) = setup_short_term();
    set_ctx(MONITOR, T0_MS + 5_000);
    c.terminate_service(accounts(TRADER), "outage".into());
    set_ctx_full(BUYER, T0_MS + 6_000, 1);
    c.claim_refund(tid.clone());
    assert_eq!(c.refundable_of(tid.clone()), U128(0));

    set_ctx(0, T0_MS + 6_000);
    c.settle_payout("rf-1", false);
    assert_eq!(c.refundable_of(tid.clone()), U128(51), "restored once");
    let tranches = c.get_token_tranches(tid.clone());
    assert_eq!(tranches[0].refunded, U128(0));

    // Lock cleared: transfer works again, and a re-claim is possible.
    set_ctx(BUYER, T0_MS + 6_000);
    NonFungibleTokenCore::nft_transfer(&mut c, accounts(NEW_OWNER), tid.clone(), None, None);
}

#[test]
fn direct_transfer_bumps_epoch_and_denies_non_owner() {
    let (mut c, tid) = setup_short_term();
    set_ctx(BUYER, T0_MS + 1_000);
    NonFungibleTokenCore::nft_transfer(&mut c, accounts(NEW_OWNER), tid.clone(), None, None);
    let lic = c.get_license(tid.clone()).unwrap();
    assert_eq!(lic.owner_id, accounts(NEW_OWNER));
    assert_eq!(lic.access_epoch, 2, "ownership transition bumps epoch");
    assert!(lic.access_active, "new owner has access while unexpired");

    // Old owner can no longer transfer (their credential epoch is stale).
    set_ctx(BUYER, T0_MS + 1_000);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        NonFungibleTokenCore::nft_transfer(&mut c, accounts(FT), tid.clone(), None, None)
    }));
    assert!(result.is_err(), "only the current owner may transfer");
}

#[test]
fn rejected_transfer_call_rollback_bumps_epoch_again() {
    let (mut c, tid) = setup_short_term();
    // Simulate a tentative transfer to NEW_OWNER (as nft_transfer_call does).
    set_ctx(BUYER, T0_MS + 1_000);
    c.tokens
        .internal_transfer_unguarded(&tid, &accounts(BUYER), &accounts(NEW_OWNER));
    c.bump_epoch(&tid);
    c.pending_transfers.insert(&tid, &());
    assert_eq!(c.get_license(tid.clone()).unwrap().access_epoch, 2);

    // Resolver rolls back (E04: A->C->A). The return-to-sender transition
    // bumps the epoch again, so A's original credentials stay invalid.
    set_ctx(0, T0_MS + 1_000);
    let accepted = c.resolve_transfer_outcome(accounts(BUYER), accounts(NEW_OWNER), tid.clone(), true);
    assert!(!accepted, "rejected call");
    let lic = c.get_license(tid.clone()).unwrap();
    assert_eq!(lic.owner_id, accounts(BUYER), "rolled back to sender");
    assert_eq!(lic.access_epoch, 3, "rollback is a second transition");
    assert!(!c.pending_transfers.get(&tid).is_some(), "pending cleared");
}
