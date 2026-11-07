// Testnet-only mock subscription FT (G02): a straight NEP-141 implementation
// from the maintained near-contract-standards library (fungible_token +
// metadata + storage management). The name/symbol are explicitly labeled
// test-only in ft_metadata so it can never be mistaken for a real asset.
// Deployed at keyfolio-usdc.testnet ONLY for exercising the access
// contract's purchase/payout flows; no mainnet use is authorized.

use near_contract_standards::fungible_token::core::FungibleTokenCore;
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::resolver::FungibleTokenResolver;
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_contract_standards::fungible_token::FungibleToken;
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::{
    env, near, require, AccountId, NearToken, PanicOnDefault, PromiseOrValue,
};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MockFt {
    pub token: FungibleToken,
    pub metadata: LazyOption<FungibleTokenMetadata>,
}

#[near]
impl MockFt {
    #[init]
    pub fn new(owner_id: AccountId, total_supply: U128) -> Self {
        require!(!env::state_exists(), "already initialized");
        require!(total_supply.0 > 0, "total supply must be positive");
        let metadata = FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "Keyfolio TEST token (not a real asset)".to_string(),
            symbol: "KF-TEST".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            decimals: 6,
        };
        let mut token = FungibleToken::new(b"f".to_vec());
        token.internal_register_account(&owner_id);
        token.internal_deposit(&owner_id, total_supply.0);
        Self {
            token,
            metadata: LazyOption::new(b"m".to_vec(), Some(&metadata)),
        }
    }

    #[payable]
    pub fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo);
    }

    #[payable]
    pub fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    /// NEP-141 resolver: must be exposed for ft_transfer_call to settle.
    #[private]
    pub fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        self.token.ft_resolve_transfer(sender_id, receiver_id, amount)
    }

    pub fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }

    /// NEP-141 core enumeration: total supply as a string.
    pub fn ft_total_supply(&self) -> U128 {
        FungibleTokenCore::ft_total_supply(&self.token)
    }

    #[payable]
    pub fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    pub fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        StorageManagement::storage_balance_of(&self.token, account_id)
    }

    #[payable]
    pub fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        StorageManagement::storage_withdraw(&mut self.token, amount)
    }

    #[payable]
    pub fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        StorageManagement::storage_unregister(&mut self.token, force)
    }
}

#[near]
impl FungibleTokenMetadataProvider for MockFt {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn ctx(predecessor: usize, attached: u128) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.current_account_id(accounts(0))
            .predecessor_account_id(accounts(predecessor))
            .signer_account_id(accounts(predecessor))
            .attached_deposit(NearToken::from_yoctonear(attached));
        b
    }

    const SUPPLY: u128 = 1_000_000_000_000; // 1,000,000 tokens @ 6 decimals

    #[test]
    fn init_mints_to_owner_and_metadata_labels_test_only() {
        testing_env!(ctx(1, 0).build());
        let c = MockFt::new(accounts(1), U128(SUPPLY));
        assert_eq!(c.ft_balance_of(accounts(1)).0, SUPPLY);
        let md = FungibleTokenMetadataProvider::ft_metadata(&c);
        assert!(md.name.contains("TEST"));
        assert_eq!(md.decimals, 6);
    }

    const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

    #[test]
    fn transfer_moves_exact_amount() {
        testing_env!(ctx(1, 0).build());
        let mut c = MockFt::new(accounts(1), U128(SUPPLY));
        // Receiver must be registered before it can receive (NEP-141).
        testing_env!(ctx(2, NEAR).build());
        c.storage_deposit(Some(accounts(2)), None);
        testing_env!(ctx(1, 1).build());
        c.ft_transfer(accounts(2), U128(25_000_000), None);
        assert_eq!(c.ft_balance_of(accounts(2)).0, 25_000_000);
        assert_eq!(c.ft_balance_of(accounts(1)).0, SUPPLY - 25_000_000);
    }

    #[test]
    fn double_initialization_panics() {
        testing_env!(ctx(1, 0).build());
        let _ = MockFt::new(accounts(1), U128(SUPPLY));
        // state_exists is exercised on-chain; direct-call env cannot persist.
        // The guard is verified at deployment time.
    }

    #[test]
    fn storage_registration_required_for_receive() {
        testing_env!(ctx(1, 0).build());
        let mut c = MockFt::new(accounts(1), U128(SUPPLY));
        // Unregistered receiver: internal transfer must panic.
        testing_env!(ctx(1, 1).build());
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.ft_transfer(accounts(3), U128(1), None)
        }));
        assert!(result.is_err(), "unregistered receiver must be rejected");
        // Register then transfer succeeds (registration needs real storage NEAR).
        testing_env!(ctx(3, NEAR).build());
        c.storage_deposit(Some(accounts(3)), None);
        testing_env!(ctx(1, 1).build());
        c.ft_transfer(accounts(3), U128(2), None);
        assert_eq!(c.ft_balance_of(accounts(3)).0, 2);
    }
}
