// Keyfolio access contract (KF-05 — IN PROGRESS, not complete).
//
// Target scope (baseline 01 sections 9-10, KF-D010): plans, license NFT
// (NEP-171/177 via near-contract-standards), subscription tranches with
// linear vesting, service termination refunds and asynchronous payout
// recovery. Financial authority lives on-chain; the backend only projects
// state for entitlement.
//
// Implemented so far: the overflow-safe vesting helper (src/vesting.rs,
// PASS_LOCAL with independent expected values). Contract state, purchase/
// renewal flows, payout callbacks and transfer/epoch handling land in
// KF-05b/c/d. This file is NOT functional contract logic yet; KF-05 must not
// be reported complete from this scaffold.

pub mod vesting;

use near_sdk::near;

pub const CONTRACT_VERSION: &str = "kf-05-wip";

#[near(contract_state)]
pub struct AccessContract {
    // KF-05b fills state: admin/monitor/FT ids, traders, plans, tokens,
    // tranches, storage balances and payout reservations.
    pub version: String,
}

impl Default for AccessContract {
    // Explicit Default keeps the version marker meaningful; the derived
    // Default would store an empty string.
    fn default() -> Self {
        Self {
            version: CONTRACT_VERSION.to_string(),
        }
    }
}

#[near]
impl AccessContract {
    /// Temporary liveness view; replaced by real views during KF-05b.
    pub fn contract_version(&self) -> String {
        self.version.clone()
    }
}

#[cfg(test)]
mod tests {
    use crate::vesting::earned_atomic;
    use crate::AccessContract;

    #[test]
    fn default_contract_carries_version_marker() {
        let contract = AccessContract::default();
        assert_eq!(contract.contract_version(), "kf-05-wip");
    }

    #[test]
    fn scaffold_links_vesting() {
        assert_eq!(earned_atomic(101, 0, 10_000, 5_000), 50);
    }
}
