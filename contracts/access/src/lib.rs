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

use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_contract_standards::non_fungible_token::{NonFungibleToken, TokenId};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, IntoStorageKey, NearToken, PanicOnDefault,
    Promise,
};

pub const CONTRACT_VERSION: &str = "kf-05b-wip";

/// Extra bytes this contract stores per mint beyond the NFT standard's
/// per-token estimate (license record, tranche record, per-token tranche
/// vector, purchase index). Verified against real usage in KF-05d evidence.
pub const STORAGE_BUFFER_BYTES: u64 = 2048;

#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKeys {
    Tranches,
    TokenTranches,
    Purchases,
    StorageBalances,
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
    pub storage_balances: UnorderedMap<AccountId, Balance>,
    pub next_tranche_seq: u64,
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
        let pkey = Self::purchase_key(&trader_id, &buyer, &purchase_id);
        if self.purchases.get(&pkey).is_some() {
            return refund; // replayed purchase id
        }

        let now = Self::block_ms();
        let end = now + plan.term_ms;
        // Receipt identity spans trader, payer and purchase id: purchase ids
        // are unique per (payer, purchase_id), so two buyers reusing the same
        // id must still mint distinct tokens.
        let token_id: TokenId = format!("kf-{}-{}-{}", trader_id, buyer, purchase_id);
        // Storage is prepaid (never taken from the FT amount): require one
        // minimum slot, deduct it from the prepaid balance, and mint without
        // attached-deposit accounting (refund_id None skips that path).
        let min = self.storage_minimum_balance();
        let prepaid = self.storage_balances.get(&buyer).unwrap_or(0);
        if prepaid < min {
            return refund;
        }
        self.storage_balances.insert(&buyer, &(prepaid - min));

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
        self.next_tranche_seq += 1;
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
                trader_id,
                issued_at_ms: now,
                expires_at_ms: end,
                plan_version,
                access_epoch: 1,
            },
        );
        self.purchases.insert(&pkey, &token_id);

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
        let end = start + plan.term_ms;

        let tranche_id = format!("tr-{}", self.next_tranche_seq);
        self.next_tranche_seq += 1;
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

        U128(0)
    }

    // ------------------------------------------------------------------
    // Storage registration (prepaid native NEAR; separate from FT price)
    // ------------------------------------------------------------------

    /// Minimum prepaid NEAR for one mint slot: the NFT standard's measured
    /// per-token cost plus a fixed buffer for this contract's license,
    /// tranche and index records. The buffer is verified against real usage
    /// in the KF-05d sandbox evidence.
    pub fn storage_minimum_balance(&self) -> Balance {
        let byte_cost = env::storage_byte_cost().as_yoctonear();
        let per_token = u128::from(self.tokens.extra_storage_in_bytes_per_token) * byte_cost;
        per_token + Balance::from(STORAGE_BUFFER_BYTES) * byte_cost
    }

    #[payable]
    pub fn storage_deposit(&mut self, account_id: Option<AccountId>) -> U128 {
        let target = account_id.unwrap_or_else(env::predecessor_account_id);
        let current = self.storage_balances.get(&target).unwrap_or(0);
        let updated = current + env::attached_deposit().as_yoctonear();
        self.storage_balances.insert(&target, &updated);
        U128(updated)
    }

    pub fn storage_balance_of(&self, account_id: AccountId) -> U128 {
        U128(self.storage_balances.get(&account_id).unwrap_or(0))
    }

    /// Withdraw the part of the prepaid balance that is not backing owned
    /// tokens. v1 keeps this simple: free = balance - owned_slots * minimum.
    #[payable]
    pub fn storage_withdraw(&mut self, amount: Option<U128>) -> U128 {
        let account = env::predecessor_account_id();
        let min = self.storage_minimum_balance();
        let owned = u128::from(self
            .tokens
            .tokens_per_owner
            .as_ref()
            .and_then(|m| m.get(&account))
            .map(|set| set.len())
            .unwrap_or(0));
        let used = owned * min;
        let balance = self.storage_balances.get(&account).unwrap_or(0);
        let free = balance.saturating_sub(used);
        let take = match amount {
            Some(a) => a.0.min(free),
            None => free,
        };
        require!(take > 0, "nothing to withdraw");
        self.storage_balances.insert(&account, &(balance - take));
        Promise::new(account.clone()).transfer(NearToken::from_yoctonear(take)).detach();
        U128(self.storage_balances.get(&account).unwrap_or(0))
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

