// Keyfolio access contract (KF-05b: state, plans, purchase/renewal, views).
//
// Financial authority lives on-chain (baseline 01 sections 9-10, KF-D010):
// one allowlisted FT, exact-price purchases minting license NFTs (NEP-171/177
// via near-contract-standards), immutable per-version plans, and linear
// vesting tranches (see src/vesting.rs). Withdrawal payouts, service
// termination/refunds and transfer epochs land in KF-05c. Nothing here is
// deployed; KF-05 is NOT complete.
//
// Validity model for ft_on_transfer: recoverable validation failures return
// the transferred amount (full refund through the standard FT resolver);
// structural caller bugs (wrong FT contract, unparsable msg) panic so the
// whole ft_transfer_call resolves as failed.

pub mod vesting;

#[cfg(test)]
mod purchase_tests;

#[cfg(test)]
mod payout_tests;

use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_contract_standards::non_fungible_token::{NonFungibleToken, TokenId};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, IntoStorageKey, NearToken,
    PanicOnDefault, Promise, PromiseOrValue,
};

pub const CONTRACT_VERSION: &str = "kf-05c-wip";

/// Gas attached to the FT transfer promise; the withdrawal/refund callback
/// runs with the remainder of this call's gas.
pub const PAYOUT_GAS: Gas = Gas::from_tgas(50);
/// Mandatory 1 yoctoNEAR on state-changing user methods (withdraw/refund).
pub const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);

/// Extra bytes this contract stores per mint beyond the NFT standard's
/// per-token estimate (license record, tranche record, per-token tranche
/// vector, purchase index). This is a planning estimate, not the charge.
pub const STORAGE_BUFFER_BYTES: u64 = 8192;

#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKeys {
    Tranches,
    TokenTranches,
    Purchases,
    StorageBalances,
    RefundLocks,
    NftOwnerById,
    NftMetadata,
    NftEnumeration,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
pub struct TraderState {
    pub sales_enabled: bool,
    pub terminated: bool,
    /// Contract block-time cutoff of the accepted termination transaction (KF-D010).
    pub terminated_at_ms: Option<u64>,
    /// Latest published plan version; renewal uses this plan's price (D07).
    pub current_plan_version: u32,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
pub struct Plan {
    /// Exact atomic amount in the allowlisted subscription FT (D04).
    pub price: Balance,
    pub term_ms: u64,
    pub active: bool,
}

pub type Balance = u128;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
pub struct LicenseInfo {
    pub trader_id: AccountId,
    pub issued_at_ms: u64,
    pub expires_at_ms: u64,
    pub plan_version: u32,
    /// Bumped on every ownership transition (KF-05c implements the bumps).
    pub access_epoch: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
pub struct Tranche {
    pub token_id: TokenId,
    pub start_ms: u64,
    pub end_ms: u64,
    /// Exact prepaid amount vested linearly over [start, end) (F-VEST).
    pub gross: Balance,
    pub withdrawn: Balance,
    pub refunded: Balance,
}

#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub struct TokenTranchesKey {
    pub token_id: TokenId,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde", tag = "action", rename_all = "snake_case")]
pub enum PurchaseAction {
    Purchase {
        trader_id: AccountId,
        plan_version: u32,
        purchase_id: String,
    },
    Renew {
        token_id: TokenId,
    },
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct AccessContract {
    pub version: String,
    pub owner_id: AccountId,
    pub monitor_id: AccountId,
    pub ft_id: AccountId,
    pub tokens: NonFungibleToken,
    pub traders: LookupMap<AccountId, TraderState>,
    /// Key: "{trader_id}|{version}". Plans are immutable once published.
    pub plans: LookupMap<String, Plan>,
    pub licenses: LookupMap<TokenId, LicenseInfo>,
    pub tranches: UnorderedMap<String, Tranche>,
    pub token_tranches: LookupMap<TokenId, Vector<String>>,
    /// Key: "{trader_id}|{payer}|{purchase_id}" -> token_id (idempotency).
    pub purchases: UnorderedMap<String, TokenId>,
    /// Prepaid native-NEAR storage (baseline 01 section 10: storage is
    /// registered separately from the FT price; never mixed with it).
    pub storage_balances: UnorderedMap<AccountId, NativeStorageAccount>,
    pub next_tranche_seq: u64,
    /// Tokens per trader for claim accounting (trader != NFT owner).
    pub trader_tokens: LookupMap<AccountId, Vector<TokenId>>,
    /// Token ids with an unresolved nft_transfer_call (access denied while set).
    pub pending_transfers: UnorderedMap<TokenId, ()>,
    /// Async payout reservations keyed by action id ("wd-"/"rf-" prefixed).
    pub payouts: UnorderedMap<String, PayoutReservation>,
    /// Tokens with a pending refund payout: transfers are locked (baseline
    /// 01 section 10).
    pub refund_locks: UnorderedMap<TokenId, ()>,
    pub next_payout_seq: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Default)]
#[borsh(crate = "near_sdk::borsh")]
pub struct NativeStorageAccount {
    pub available: Balance,
    pub pending: Balance,
    pub nonce: u64,
}

/// Funds reserved before an external FT transfer, with the exact tranche
/// allocations to restore once if the callback reports failure (N08).
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
pub struct PayoutReservation {
    pub account: AccountId,
    pub amount: Balance,
    pub kind: PayoutKind,
    pub token_id: Option<TokenId>,
    pub allocations: Vec<(String, Balance)>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(crate = "near_sdk::borsh")]
pub enum PayoutKind {
    /// Trader claiming vested earnings.
    Withdraw,
    /// Owner claiming the unvested remainder after termination.
    Refund,
}

#[near]
impl AccessContract {
    #[init]
    pub fn new(owner_id: AccountId, monitor_id: AccountId, ft_id: AccountId) -> Self {
        require!(!env::state_exists(), "already initialized");
        let tokens = NonFungibleToken::new(
            StorageKeys::NftOwnerById.into_storage_key(),
            owner_id.clone(),
            Some(StorageKeys::NftMetadata.into_storage_key()),
            Some(StorageKeys::NftEnumeration.into_storage_key()),
            None::<Vec<u8>>, // approvals: no marketplace in v1
        );
        Self {
            version: CONTRACT_VERSION.to_string(),
            owner_id,
            monitor_id,
            ft_id,
            tokens,
            traders: LookupMap::new(b"t".to_vec()),
            plans: LookupMap::new(b"p".to_vec()),
            licenses: LookupMap::new(b"l".to_vec()),
            tranches: UnorderedMap::new(StorageKeys::Tranches.into_storage_key()),
            token_tranches: LookupMap::new(StorageKeys::TokenTranches.into_storage_key()),
            purchases: UnorderedMap::new(StorageKeys::Purchases.into_storage_key()),
            storage_balances: UnorderedMap::new(StorageKeys::StorageBalances.into_storage_key()),
            next_tranche_seq: 0,
            trader_tokens: LookupMap::new(b"tt".to_vec()),
            pending_transfers: UnorderedMap::new(b"pt".to_vec()),
            payouts: UnorderedMap::new(b"po".to_vec()),
            refund_locks: UnorderedMap::new(StorageKeys::RefundLocks.into_storage_key()),
            next_payout_seq: 0,
        }
    }

    /// Block timestamp in checked milliseconds (u64 ns / 10^6 fits u64 for
    /// any realistic chain time).
    fn block_ms() -> u64 {
        env::block_timestamp() / 1_000_000
    }

    fn plan_key(trader_id: &AccountId, version: u32) -> String {
        format!("{}|{}", trader_id, version)
    }

    fn purchase_key(trader_id: &AccountId, payer: &AccountId, purchase_id: &str) -> String {
        format!("{}|{}|{}", trader_id, payer, purchase_id)
    }

    /// Operator publishes an immutable plan version for a trader. Re-setting
    /// an existing version is allowed only with identical terms (idempotent).
    /// Creating the first plan also registers the trader with sales enabled.
    pub fn set_plan(&mut self, trader_id: AccountId, version: u32, price: U128, term_ms: u64) {
        require!(env::predecessor_account_id() == self.owner_id, "owner only");
        require!(version >= 1, "plan version must be >= 1");
        require!(price.0 > 0, "plan price must be positive");
        require!(
            term_ms >= 1 && (term_ms as u128) <= vesting::MAX_TERM_MS,
            "term must be 1..=MAX_TERM_MS ms"
        );
        let key = Self::plan_key(&trader_id, version);
        if let Some(existing) = self.plans.get(&key) {
            require!(
                existing.price == price.0 && existing.term_ms == term_ms && existing.active,
                "published plans are immutable; publish a new version instead"
            );
        } else {
            self.plans.insert(&key, &Plan { price: price.0, term_ms, active: true });
        }
        let mut trader = self.traders.get(&trader_id).unwrap_or(TraderState {
            sales_enabled: true,
            terminated: false,
            terminated_at_ms: None,
            current_plan_version: version,
        });
        if version > trader.current_plan_version {
            trader.current_plan_version = version;
        }
        self.traders.insert(&trader_id, &trader);
    }

    /// Operator pauses/resumes new sales for a trader (coverage/health gates
    /// stay enforced off-chain before this is called; termination is 05c).
    pub fn set_sales_enabled(&mut self, trader_id: AccountId, enabled: bool) {
        require!(env::predecessor_account_id() == self.owner_id, "owner only");
        let mut trader = self.traders.get(&trader_id).expect("unknown trader");
        require!(!trader.terminated, "service terminated");
        trader.sales_enabled = enabled;
        self.traders.insert(&trader_id, &trader);
    }

    /// NEP-141 receiver. The predecessor MUST be the allowlisted FT. Exact
    /// price, unused purchase id and sales/termination state are enforced;
    /// any recoverable failure returns the full transferred amount.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> U128 {
        require!(env::predecessor_account_id() == self.ft_id, "only the allowlisted FT may call ft_on_transfer");
        let action: PurchaseAction = near_sdk::serde_json::from_str(&msg)
            .expect("unparsable purchase message");
        match action {
            PurchaseAction::Purchase { trader_id, plan_version, purchase_id } => {
                self.handle_purchase(sender_id, amount.0, trader_id, plan_version, purchase_id)
            }
            PurchaseAction::Renew { token_id } => self.handle_renew(sender_id, amount.0, token_id),
        }
    }

    fn handle_purchase(
        &mut self,
        buyer: AccountId,
        amount: Balance,
        trader_id: AccountId,
        plan_version: u32,
        purchase_id: String,
    ) -> U128 {
        let refund = U128(amount);
        // unknown, terminated or sales paused -> refund
        if !self
            .traders
            .get(&trader_id)
            .map(|t| !t.terminated && t.sales_enabled)
            .unwrap_or(false)
        {
            return refund;
        }
        let plan = match self.plans.get(&Self::plan_key(&trader_id, plan_version)) {
            Some(p) if p.active => p,
            _ => return refund,
        };
        if amount != plan.price {
            return refund; // exact-price model: never accept partial/overpay
        }
        if purchase_id.is_empty() || purchase_id.len() > 128 || !purchase_id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.') {
            return refund;
        }
        let pkey = Self::purchase_key(&trader_id, &buyer, &purchase_id);
        if self.purchases.get(&pkey).is_some() {
            return refund; // replayed purchase id
        }

        let now = Self::block_ms();
        let end = now.checked_add(plan.term_ms).expect("expiry overflow");
        // Receipt identity spans trader, payer and purchase id: purchase ids
        // are unique per (payer, purchase_id), so two buyers reusing the same
        // id must still mint distinct tokens.
        let token_id: TokenId = format!("kf-{}-{}-{}", trader_id, buyer, purchase_id);
        if self.storage_balances.get(&buyer).is_none() { return refund; }
        let storage_before = env::storage_usage();

        let token = self.tokens.internal_mint_with_refund(
            token_id.clone(),
            buyer.clone(),
            Some(TokenMetadata {
                title: Some("Keyfolio Access".to_string()),
                description: Some(format!("Access to {} trading activity", trader_id)),
                media: None,
                media_hash: None,
                copies: Some(1),
                issued_at: Some(now.to_string()),
                expires_at: Some((u128::from(end) * 1_000_000u128).to_string()),
                starts_at: None,
                updated_at: None,
                extra: None,
                reference: None,
                reference_hash: None,
            }),
            None, // no refund: storage was prepaid and accounted above
        );
        require!(token.owner_id == buyer, "mint failed");

        let tranche_id = format!("tr-{}", self.next_tranche_seq);
        self.next_tranche_seq = self.next_tranche_seq.checked_add(1).expect("tranche sequence overflow");
        self.tranches.insert(
            &tranche_id,
            &Tranche {
                token_id: token_id.clone(),
                start_ms: now,
                end_ms: end,
                gross: plan.price,
                withdrawn: 0,
                refunded: 0,
            },
        );
        let mut list = self
            .token_tranches
            .get(&token_id)
            .unwrap_or_else(|| Vector::new(TokenTranchesKey { token_id: token_id.clone() }));
        list.push(&tranche_id);
        self.token_tranches.insert(&token_id, &list);

        self.licenses.insert(
            &token_id,
            &LicenseInfo {
                trader_id: trader_id.clone(),
                issued_at_ms: now,
                expires_at_ms: end,
                plan_version,
                access_epoch: 1,
            },
        );
        self.purchases.insert(&pkey, &token_id);
        let mut tlist = self
            .trader_tokens
            .get(&trader_id)
            .unwrap_or_else(|| Vector::new([b"tk".as_slice(), trader_id.as_bytes()].concat()));
        tlist.push(&token_id.clone());
        self.trader_tokens.insert(&trader_id, &tlist);

        self.charge_storage_growth(&buyer, storage_before);

        near_contract_standards::non_fungible_token::events::NftMint {
            owner_id: &buyer,
            token_ids: &[&token_id],
            memo: Some("keyfolio access license minted"),
        }
        .emit();

        U128(0)
    }

    fn handle_renew(&mut self, payer: AccountId, amount: Balance, token_id: TokenId) -> U128 {
        let refund = U128(amount);
        if self.pending_transfers.get(&token_id).is_some() { return refund; }
        let mut license = match self.licenses.get(&token_id) {
            Some(l) => l,
            None => return refund,
        };
        let owner = match self.tokens.owner_by_id.get(&token_id) {
            Some(o) => o,
            None => return refund,
        };
        if owner != payer {
            return refund; // D07: current owner only
        }
        let trader = match self.traders.get(&license.trader_id) {
            Some(t) if !t.terminated => t,
            _ => return refund, // renewal after termination is not allowed
        };
        let plan = match self
            .plans
            .get(&Self::plan_key(&license.trader_id, trader.current_plan_version))
        {
            Some(p) if p.active => p,
            _ => return refund,
        };
        if amount != plan.price {
            return refund;
        }

        let now = Self::block_ms();
        // D07: new expiry = max(now, old expiry) + term; purchased terms stay intact.
        let start = std::cmp::max(now, license.expires_at_ms);
        let end = start.checked_add(plan.term_ms).expect("expiry overflow");
        if self.storage_balances.get(&payer).is_none() { return refund; }
        let storage_before = env::storage_usage();

        let tranche_id = format!("tr-{}", self.next_tranche_seq);
        self.next_tranche_seq = self.next_tranche_seq.checked_add(1).expect("tranche sequence overflow");
        self.tranches.insert(
            &tranche_id,
            &Tranche {
                token_id: token_id.clone(),
                start_ms: start,
                end_ms: end,
                gross: plan.price,
                withdrawn: 0,
                refunded: 0,
            },
        );
        let mut list = self
            .token_tranches
            .get(&token_id)
            .unwrap_or_else(|| Vector::new(TokenTranchesKey { token_id: token_id.clone() }));
        list.push(&tranche_id);
        self.token_tranches.insert(&token_id, &list);

        license.expires_at_ms = end;
        self.licenses.insert(&token_id, &license);
        self.charge_storage_growth(&payer, storage_before);

        U128(0)
    }

    // ------------------------------------------------------------------
    // Storage registration (prepaid native NEAR; separate from FT price)
    // ------------------------------------------------------------------

    /// Legacy planning estimate only; exact charge depends on actual records.
    pub fn storage_minimum_balance(&self) -> U128 {
        let bytes = u128::from(self.tokens.extra_storage_in_bytes_per_token)
            .checked_add(u128::from(STORAGE_BUFFER_BYTES)).expect("storage estimate overflow");
        U128(bytes.checked_mul(env::storage_byte_cost().as_yoctonear()).expect("storage estimate overflow"))
    }

    fn storage_cost(bytes: u64) -> Balance {
        u128::from(bytes).checked_mul(env::storage_byte_cost().as_yoctonear()).expect("storage cost overflow")
    }

    fn charge_storage_growth(&mut self, account: &AccountId, before: u64) {
        let bytes = env::storage_usage().checked_sub(before).expect("unexpected storage shrink");
        let charge = Self::storage_cost(bytes);
        let mut entry = self.storage_balances.get(account).expect("storage registration required");
        entry.available = entry.available.checked_sub(charge).expect("insufficient prepaid storage");
        self.storage_balances.insert(account, &entry);
    }

    #[payable]
    pub fn storage_deposit(&mut self, account_id: Option<AccountId>) -> U128 {
        let target = account_id.unwrap_or_else(env::predecessor_account_id);
        let deposit = env::attached_deposit().as_yoctonear();
        let before = env::storage_usage();
        let mut entry = self.storage_balances.get(&target).unwrap_or_default();
        self.storage_balances.insert(&target, &entry);
        let cost = Self::storage_cost(env::storage_usage().checked_sub(before).expect("storage shrink"));
        let net = deposit.checked_sub(cost).expect("deposit below registration storage cost");
        entry.available = entry.available.checked_add(net).expect("storage balance overflow");
        entry.available.checked_add(entry.pending).expect("storage liability overflow");
        self.storage_balances.insert(&target, &entry);
        U128(entry.available)
    }

    pub fn storage_balance_of(&self, account_id: AccountId) -> U128 {
        U128(self.storage_balances.get(&account_id).map(|e| e.available).unwrap_or(0))
    }

    #[payable]
    pub fn storage_withdraw(&mut self, amount: Option<U128>) -> U128 {
        require!(env::attached_deposit() == ONE_YOCTO, "attach exactly 1 yoctoNEAR");
        let account = env::predecessor_account_id();
        let mut entry = self.storage_balances.get(&account).expect("storage registration required");
        require!(entry.pending == 0, "native payout pending");
        let take = amount.map(|a| a.0.min(entry.available)).unwrap_or(entry.available);
        require!(take > 0, "nothing to withdraw");
        entry.available = entry.available.checked_sub(take).expect("insufficient credit");
        entry.pending = take;
        entry.nonce = entry.nonce.checked_add(1).expect("native payout nonce overflow");
        let nonce = entry.nonce;
        self.storage_balances.insert(&account, &entry);
        let args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({"account_id": account, "nonce": nonce})).unwrap();
        Promise::new(account).transfer(NearToken::from_yoctonear(take)).then(
            Promise::new(env::current_account_id()).function_call("storage_withdraw_callback", args, NearToken::from_yoctonear(0), PAYOUT_GAS)
        ).detach();
        U128(entry.available)
    }

    #[private]
    pub fn storage_withdraw_callback(&mut self, account_id: AccountId, nonce: u64) {
        let success = env::promise_result_checked(0, 0).is_ok();
        self.settle_native_withdrawal(account_id, nonce, success);
    }

    fn settle_native_withdrawal(&mut self, account: AccountId, nonce: u64, success: bool) {
        let mut entry = self.storage_balances.get(&account).expect("storage registration required");
        require!(entry.pending > 0 && entry.nonce == nonce, "unknown native payout");
        if !success {
            entry.available = entry.available.checked_add(entry.pending).expect("storage balance overflow");
        }
        entry.pending = 0;
        self.storage_balances.insert(&account, &entry);
    }

    // ==================================================================
    // KF-05c: service termination, payouts, refunds, NFT transfers
    // ==================================================================

    /// Monitor (or owner) terminates a trader's service. The financial cutoff
    /// is THIS transaction's block timestamp (KF-D010): callers cannot supply
    /// an earlier outage timestamp. Freezes earnings and access; vested funds
    /// stay claimable; the unvested remainder becomes refundable to the
    /// current NFT owner.
    pub fn terminate_service(&mut self, trader_id: AccountId, reason: String) {
        let caller = env::predecessor_account_id();
        require!(
            caller == self.monitor_id || caller == self.owner_id,
            "monitor or owner only"
        );
        let mut trader = self.traders.get(&trader_id).expect("unknown trader");
        require!(!trader.terminated, "already terminated");
        trader.terminated = true;
        trader.sales_enabled = false;
        trader.terminated_at_ms = Some(Self::block_ms());
        self.traders.insert(&trader_id, &trader);
        env::log_str(
            &near_sdk::serde_json::json!({
                "standard": "keyfolio",
                "version": "1.0.0",
                "event": "service_terminated",
                "data": [{
                    "trader_id": trader_id,
                    "cutoff_ms": trader.terminated_at_ms,
                    "reason": reason,
                }]
            })
            .to_string(),
        );
    }

    /// Valuation time for earnings: the accepted termination cutoff once
    /// terminated, otherwise the current block time.
    fn effective_now(&self, trader: &TraderState) -> u64 {
        match trader.terminated_at_ms {
            Some(t) => t,
            None => Self::block_ms(),
        }
    }

    /// Vested-but-unwithdrawn earnings across all of the trader's tokens,
    /// evaluated at the effective time (cutoff after termination).
    pub fn claimable_of(&self, trader_id: AccountId) -> U128 {
        let trader = match self.traders.get(&trader_id) {
            Some(t) => t,
            None => return U128(0),
        };
        let now = self.effective_now(&trader);
        let mut total: Balance = 0;
        if let Some(tokens) = self.trader_tokens.get(&trader_id) {
            for token_id in tokens.iter() {
                if let Some(list) = self.token_tranches.get(&token_id) {
                    for tranche_id in list.iter() {
                        if let Some(tr) = self.tranches.get(&tranche_id) {
                            let earned = vesting::earned_atomic(
                                tr.gross,
                                tr.start_ms as u128,
                                tr.end_ms as u128,
                                now as u128,
                            );
                            total += earned.saturating_sub(tr.withdrawn);
                        }
                    }
                }
            }
        }
        U128(total)
    }

    /// Unvested remainder refundable to the current NFT owner after
    /// termination: sum of (gross - earned_at_cutoff - refunded) per tranche.
    pub fn refundable_of(&self, token_id: TokenId) -> U128 {
        let license = match self.licenses.get(&token_id) {
            Some(l) => l,
            None => return U128(0),
        };
        let trader = match self.traders.get(&license.trader_id) {
            Some(t) if t.terminated => t,
            _ => return U128(0),
        };
        let cutoff = trader.terminated_at_ms.unwrap_or(Self::block_ms());
        let mut total: Balance = 0;
        if let Some(list) = self.token_tranches.get(&token_id) {
            for tranche_id in list.iter() {
                if let Some(tr) = self.tranches.get(&tranche_id) {
                    let earned = vesting::earned_atomic(
                        tr.gross,
                        tr.start_ms as u128,
                        tr.end_ms as u128,
                        cutoff as u128,
                    );
                    total += tr.gross - earned - tr.refunded;
                }
            }
        }
        U128(total)
    }

    fn bump_epoch(&mut self, token_id: &TokenId) {
        let mut license = self.licenses.get(token_id).expect("license must exist");
        license.access_epoch += 1;
        self.licenses.insert(token_id, &license);
    }

    /// Trader withdraws vested earnings via an asynchronous FT payout: funds
    /// are reserved into `withdrawn` BEFORE the external call, and the private
    /// callback finalizes on success or restores the reservation exactly once
    /// on failure (baseline 01 section 10, N08).
    #[payable]
    pub fn ft_withdraw(&mut self, amount: Option<U128>) -> PromiseOrValue<U128> {
        require!(env::attached_deposit() == ONE_YOCTO, "attach 1 yoctoNEAR");
        let caller = env::predecessor_account_id();
        let claimable = self.claimable_of(caller.clone()).0;
        require!(claimable > 0, "nothing vested to withdraw");
        let take = match amount {
            Some(a) => a.0.min(claimable),
            None => claimable,
        };
        require!(take > 0, "nothing to withdraw");

        let trader = self.traders.get(&caller).expect("unknown trader");
        let now = self.effective_now(&trader);
        let mut remaining = take;
        let mut allocations: Vec<(String, Balance)> = Vec::new();
        if let Some(tokens) = self.trader_tokens.get(&caller) {
            'tokens: for token_id in tokens.iter() {
                if let Some(list) = self.token_tranches.get(&token_id) {
                    for tranche_id in list.iter() {
                        if remaining == 0 {
                            break 'tokens;
                        }
                        let mut tr = match self.tranches.get(&tranche_id) {
                            Some(t) => t,
                            None => continue,
                        };
                        let earned = vesting::earned_atomic(
                            tr.gross,
                            tr.start_ms as u128,
                            tr.end_ms as u128,
                            now as u128,
                        );
                        let available = earned.saturating_sub(tr.withdrawn);
                        if available == 0 {
                            continue;
                        }
                        let portion = available.min(remaining);
                        tr.withdrawn += portion;
                        self.tranches.insert(&tranche_id, &tr);
                        allocations.push((tranche_id, portion));
                        remaining -= portion;
                    }
                }
            }
        }
        require!(remaining == 0, "allocation shortfall (invariant)");

        self.next_payout_seq += 1;
        let action_id = format!("wd-{}", self.next_payout_seq);
        self.payouts.insert(
            &action_id,
            &PayoutReservation {
                account: caller.clone(),
                amount: take,
                kind: PayoutKind::Withdraw,
                token_id: None,
                allocations,
            },
        );

        let args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "receiver_id": caller,
            "amount": U128(take),
            "memo": action_id,
        }))
        .unwrap();
        let cb_args: Vec<u8> =
            near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({ "action_id": action_id }))
                .unwrap();
        PromiseOrValue::Promise(
            Promise::new(self.ft_id.clone())
                .function_call("ft_transfer".to_string(), args, ONE_YOCTO, PAYOUT_GAS)
                .then(
                    Promise::new(env::current_account_id()).function_call(
                        "payout_callback".to_string(),
                        cb_args,
                        NearToken::from_yoctonear(0),
                        PAYOUT_GAS,
                    ),
                ),
        )
    }

    /// Current NFT owner claims the unvested remainder after service
    /// termination. Transfers of this token are locked while the refund is
    /// pending; the payout is asynchronous with a once-only callback.
    #[payable]
    pub fn claim_refund(&mut self, token_id: TokenId) -> PromiseOrValue<U128> {
        require!(env::attached_deposit() == ONE_YOCTO, "attach 1 yoctoNEAR");
        require!(self.pending_transfers.get(&token_id).is_none(), "transfer pending");
        let caller = env::predecessor_account_id();
        let license = self.licenses.get(&token_id).expect("unknown token");
        let trader = self
            .traders
            .get(&license.trader_id)
            .expect("unknown trader");
        require!(trader.terminated, "service not terminated");
        let owner = self
            .tokens
            .owner_by_id
            .get(&token_id)
            .expect("token must exist");
        require!(owner == caller, "only the current NFT owner may claim refunds");
        require!(
            self.refund_locks.get(&token_id).is_none(),
            "refund already pending for this token"
        );
        let refundable = self.refundable_of(token_id.clone()).0;
        require!(refundable > 0, "nothing unvested to refund");

        let cutoff = trader.terminated_at_ms.unwrap_or(Self::block_ms());
        let mut remaining = refundable;
        let mut allocations: Vec<(String, Balance)> = Vec::new();
        if let Some(list) = self.token_tranches.get(&token_id) {
            for tranche_id in list.iter() {
                if remaining == 0 {
                    break;
                }
                let mut tr = self.tranches.get(&tranche_id).unwrap();
                let earned = vesting::earned_atomic(
                    tr.gross,
                    tr.start_ms as u128,
                    tr.end_ms as u128,
                    cutoff as u128,
                );
                let unvested = tr.gross - earned - tr.refunded;
                if unvested == 0 {
                    continue;
                }
                let portion = unvested.min(remaining);
                tr.refunded += portion;
                self.tranches.insert(&tranche_id, &tr);
                allocations.push((tranche_id, portion));
                remaining -= portion;
            }
        }
        require!(remaining == 0, "allocation shortfall (invariant)");

        self.next_payout_seq += 1;
        let action_id = format!("rf-{}", self.next_payout_seq);
        self.payouts.insert(
            &action_id,
            &PayoutReservation {
                account: caller.clone(),
                amount: refundable,
                kind: PayoutKind::Refund,
                token_id: Some(token_id.clone()),
                allocations,
            },
        );
        self.refund_locks.insert(&token_id, &());

        let args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "receiver_id": caller,
            "amount": U128(refundable),
            "memo": action_id,
        }))
        .unwrap();
        let cb_args: Vec<u8> =
            near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({ "action_id": action_id }))
                .unwrap();
        PromiseOrValue::Promise(
            Promise::new(self.ft_id.clone())
                .function_call("ft_transfer".to_string(), args, ONE_YOCTO, PAYOUT_GAS)
                .then(
                    Promise::new(env::current_account_id()).function_call(
                        "payout_callback".to_string(),
                        cb_args,
                        NearToken::from_yoctonear(0),
                        PAYOUT_GAS,
                    ),
                ),
        )
    }

    /// Private callback for both payout kinds. Requires the contract itself
    /// as predecessor and a known action id; settles exactly once (N08).
    #[private]
    pub fn payout_callback(&mut self, action_id: String) {
        let succeeded = env::promise_result_checked(0, u64::MAX as usize).is_ok();
        self.settle_payout(&action_id, succeeded);
    }

    /// Settlement core shared by the on-chain callback and unit tests: the
    /// reservation is removed first (a second callback panics), failure
    /// restores every tranche allocation once, and refund locks clear in
    /// both outcomes.
    pub(crate) fn settle_payout(&mut self, action_id: &str, succeeded: bool) {
        let reservation = self
            .payouts
            .remove(&action_id.to_string())
            .expect("unknown payout action (already settled?)");
        if !succeeded {
            for (tranche_id, portion) in &reservation.allocations {
                let mut tr = self.tranches.get(tranche_id).expect("tranche must exist");
                match reservation.kind {
                    PayoutKind::Withdraw => tr.withdrawn -= portion,
                    PayoutKind::Refund => tr.refunded -= portion,
                }
                self.tranches.insert(tranche_id, &tr);
            }
        }
        if let Some(token_id) = &reservation.token_id {
            self.refund_locks.remove(token_id);
        }
        env::log_str(
            &near_sdk::serde_json::json!({
                "standard": "keyfolio",
                "version": "1.0.0",
                "event": if succeeded { "payout_settled" } else { "payout_restored" },
                "data": [{
                    "action_id": action_id,
                    "account": reservation.account,
                    "amount": U128(reservation.amount),
                    "kind": format!("{:?}", reservation.kind),
                }]
            })
            .to_string(),
        );
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    pub fn contract_info(&self) -> ContractInfo {
        ContractInfo {
            version: self.version.clone(),
            owner_id: self.owner_id.clone(),
            monitor_id: self.monitor_id.clone(),
            ft_id: self.ft_id.clone(),
        }
    }

    pub fn get_trader(&self, trader_id: AccountId) -> Option<TraderStateJson> {
        self.traders.get(&trader_id).map(|t| TraderStateJson {
            sales_enabled: t.sales_enabled,
            terminated: t.terminated,
            terminated_at_ms: t.terminated_at_ms,
            current_plan_version: t.current_plan_version,
        })
    }

    pub fn get_plan(&self, trader_id: AccountId, version: u32) -> Option<PlanJson> {
        self.plans.get(&Self::plan_key(&trader_id, version)).map(plan_json)
    }

    pub fn get_current_plan(&self, trader_id: AccountId) -> Option<PlanJson> {
        let trader = self.traders.get(&trader_id)?;
        self.plans
            .get(&Self::plan_key(&trader_id, trader.current_plan_version))
            .map(plan_json)
    }

    pub fn get_license(&self, token_id: TokenId) -> Option<LicenseJson> {
        let license = self.licenses.get(&token_id)?;
        let owner = self.tokens.owner_by_id.get(&token_id)?;
        let trader = self.traders.get(&license.trader_id);
        let now = Self::block_ms();
        Some(LicenseJson {
            token_id: token_id.clone(),
            owner_id: owner,
            trader_id: license.trader_id,
            issued_at_ms: license.issued_at_ms,
            expires_at_ms: license.expires_at_ms,
            plan_version: license.plan_version,
            access_epoch: license.access_epoch,
            // Derived, not stored: access is active only while unexpired,
            // sales/disclosure enabled and the service not terminated.
            access_active: now < license.expires_at_ms
                && trader.map(|t| t.sales_enabled && !t.terminated).unwrap_or(false),
        })
    }

    pub fn get_token_tranches(&self, token_id: TokenId) -> Vec<TrancheJson> {
        match self.token_tranches.get(&token_id) {
            Some(list) => list
                .iter()
                .filter_map(|id| {
                    let tranche = self.tranches.get(&id)?;
                    Some(tranche_json(id, tranche))
                })
                .collect(),
            None => Vec::new(),
        }
    }

    pub fn has_purchase(&self, trader_id: AccountId, payer: AccountId, purchase_id: String) -> bool {
        self.purchases
            .get(&Self::purchase_key(&trader_id, &payer, &purchase_id))
            .is_some()
    }
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractInfo {
    pub version: String,
    pub owner_id: AccountId,
    pub monitor_id: AccountId,
    pub ft_id: AccountId,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TraderStateJson {
    pub sales_enabled: bool,
    pub terminated: bool,
    pub terminated_at_ms: Option<u64>,
    pub current_plan_version: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PlanJson {
    pub price: U128,
    pub term_ms: u64,
    pub active: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct LicenseJson {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub trader_id: AccountId,
    pub issued_at_ms: u64,
    pub expires_at_ms: u64,
    pub plan_version: u32,
    pub access_epoch: u64,
    pub access_active: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TrancheJson {
    pub tranche_id: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub gross: U128,
    pub withdrawn: U128,
    pub refunded: U128,
}

fn plan_json(p: Plan) -> PlanJson {
    PlanJson { price: U128(p.price), term_ms: p.term_ms, active: p.active }
}

fn tranche_json(id: String, t: Tranche) -> TrancheJson {
    TrancheJson {
        tranche_id: id,
        start_ms: t.start_ms,
        end_ms: t.end_ms,
        gross: U128(t.gross),
        withdrawn: U128(t.withdrawn),
        refunded: U128(t.refunded),
    }
}


// ==================================================================
// KF-05c: NEP-171 core with access-epoch transitions (no approvals in v1)
// ==================================================================

use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::events::NftTransfer;
use near_contract_standards::non_fungible_token::metadata::NonFungibleTokenMetadataProvider;
use near_contract_standards::non_fungible_token::Token;

#[near]
impl NonFungibleTokenCore for AccessContract {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        _approval_id: Option<u64>,
        _memo: Option<String>,
    ) {
        // v1 has no approvals/marketplace: only the current owner transfers.
        require!(env::attached_deposit() == ONE_YOCTO, "requires exactly one yoctoNEAR");
        require!(self.pending_transfers.get(&token_id).is_none(), "transfer pending");
        let sender = env::predecessor_account_id();
        let owner = self
            .tokens
            .owner_by_id
            .get(&token_id)
            .expect("unknown token");
        require!(owner == sender, "only the token owner may transfer");
        require!(
            self.refund_locks.get(&token_id).is_none(),
            "refund pending: transfers of this token are locked"
        );
        let storage_before = env::storage_usage();
        self.tokens
            .internal_transfer_unguarded(&token_id, &sender, &receiver_id);
        // Every ownership transition changes the credential epoch (D06/E03).
        self.bump_epoch(&token_id);
        if env::storage_usage() > storage_before {
            self.charge_storage_growth(&sender, storage_before);
        }
        NftTransfer {
            old_owner_id: &sender,
            new_owner_id: &receiver_id,
            token_ids: &[&token_id],
            authorized_id: None,
            memo: _memo.as_deref(),
        }
        .emit();
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        _approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        require!(env::attached_deposit() == ONE_YOCTO, "requires exactly one yoctoNEAR");
        require!(self.pending_transfers.get(&token_id).is_none(), "transfer pending");
        let sender = env::predecessor_account_id();
        let owner = self
            .tokens
            .owner_by_id
            .get(&token_id)
            .expect("unknown token");
        require!(owner == sender, "only the token owner may transfer");
        require!(
            self.refund_locks.get(&token_id).is_none(),
            "refund pending: transfers of this token are locked"
        );
        // Tentative transfer is itself an ownership transition: credentials
        // of the sender become invalid immediately and the token is marked
        // pending (E06) until the receiver callback resolves.
        self.tokens
            .internal_transfer_unguarded(&token_id, &sender, &receiver_id);
        self.bump_epoch(&token_id);
        self.pending_transfers.insert(&token_id, &());
        NftTransfer {
            old_owner_id: &sender,
            new_owner_id: &receiver_id,
            token_ids: &[&token_id],
            authorized_id: None,
            memo: memo.as_deref(),
        }
        .emit();

        let receiver_args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "sender_id": sender,
            "previous_owner_id": sender,
            "token_id": token_id,
            "msg": msg,
        }))
        .unwrap();
        let resolve_args: Vec<u8> = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "previous_owner_id": sender,
            "receiver_id": receiver_id,
            "token_id": token_id,
        }))
        .unwrap();
        PromiseOrValue::Promise(
            Promise::new(receiver_id)
                .function_call(
                    "nft_on_transfer".to_string(),
                    receiver_args,
                    NearToken::from_yoctonear(0),
                    PAYOUT_GAS,
                )
                .then(
                    Promise::new(env::current_account_id()).function_call(
                        "nft_resolve_transfer".to_string(),
                        resolve_args,
                        NearToken::from_yoctonear(0),
                        PAYOUT_GAS,
                    ),
                ),
        )
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }

}

#[near]
impl AccessContract {
    /// Private resolver for nft_transfer_call: clears the pending mark and,
    /// when the receiver rejected (or its callback failed) and it still owns
    /// the token, rolls the token back. The tentative transfer and the
    /// rollback are BOTH ownership transitions, so the epoch bumps twice for
    /// a rejected call (E04: A->C->A never revives A's old credentials).
    #[private]
    pub fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
    ) -> bool {
        // A missing/unreadable result counts as rejected (fail closed).
        let rejected = match env::promise_result_checked(0, u64::MAX as usize) {
            Ok(value) => near_sdk::serde_json::from_slice::<bool>(&value).unwrap_or(true),
            Err(_) => true,
        };
        self.resolve_transfer_outcome(previous_owner_id, receiver_id, token_id, rejected)
    }

    /// Resolve core shared by the on-chain callback and unit tests.
    pub(crate) fn resolve_transfer_outcome(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        rejected: bool,
    ) -> bool {
        self.pending_transfers.remove(&token_id);
        if rejected {
            let current = self.tokens.owner_by_id.get(&token_id);
            if current.as_ref() == Some(&receiver_id) {
                self.tokens
                    .internal_transfer_unguarded(&token_id, &receiver_id, &previous_owner_id);
                self.bump_epoch(&token_id);
                NftTransfer {
                    old_owner_id: &receiver_id,
                    new_owner_id: &previous_owner_id,
                    token_ids: &[&token_id],
                    authorized_id: None,
                    memo: Some("transfer_call rejected: rolled back"),
                }
                .emit();
                return false;
            }
        }
        true
    }
}

#[near]
impl NonFungibleTokenEnumeration for AccessContract {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens.nft_tokens_for_owner(account_id, from_index, limit)
    }
}

/// NEP-177 contract metadata is served through the standard provider trait.
#[near]
impl NonFungibleTokenMetadataProvider for AccessContract {
    fn nft_metadata(
        &self,
    ) -> near_contract_standards::non_fungible_token::metadata::NFTContractMetadata {
        near_contract_standards::non_fungible_token::metadata::NFTContractMetadata {
            spec: "nft-1.0.0".to_string(),
            name: "Keyfolio Access".to_string(),
            symbol: "KFA".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            base_uri: None,
        }
    }
}
