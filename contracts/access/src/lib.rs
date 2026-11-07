// Keyfolio access contract (KF-02c scaffold).
//
// KF-02c proves the Rust/near-sdk toolchain compiles and links a cdylib
// contract on this checkout. Plans, NFT licensing, vesting, termination and
// payout recovery are implemented with KF-05; nothing here is deployed and no
// financial behavior is implied by this scaffold.

use near_sdk::near;

#[near(contract_state)]
#[derive(Default)]
pub struct AccessContract {
    // KF-05 state (plans, tokens, tranches, payouts) is added there.
}

#[near]
impl AccessContract {
    /// Scaffold liveness marker; replaced by real views in KF-05.
    pub fn ping(&self) -> String {
        "kf-02c".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_returns_scaffold_tag() {
        let contract = AccessContract::default();
        assert_eq!(contract.ping(), "kf-02c");
    }
}
