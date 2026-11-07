# KF-05b evidence — contract state, plans, purchase/renewal (PASS_LOCAL)

Task/Test ID: KF-05b (partial): contract state, immutable plans, ft_on_transfer purchase and renewal, prepaid storage, read views. NOT KF-05 acceptance: withdraw payouts, service termination/refunds, transfer/epoch handling and sandbox tests are still TODO (KF-05c/05d).

Commit + branch: see git log for the commit carrying this file; branch main.
Environment: local Windows host; cargo 1.99.0; near-sdk 5.30.1 + near-contract-standards 5.30.1 (NEP-171/177 via maintained standard library); deps via Cargo.lock (`--locked`).
Commands: `cargo test --locked` (18 tests: 6 vesting + 12 purchase/renewal), `cargo check --locked --target wasm32-unknown-unknown`.
Observed result: 18/18 pass; wasm32 target compiles clean; no warnings.
Classification: PASS_LOCAL.

## What the tests prove (independent expected values)

- Purchase with exact FT amount mints a license NFT owned by the buyer, creates tranche [block_time, block_time + term), records idempotency key; returns U128(0).
- Any price mismatch, unknown trader, sales paused, or replayed (trader, payer, purchase_id) returns the FULL transferred amount and mints nothing (exact-price model, baseline 01 section 10).
- Token ids span trader + payer + purchase id: two buyers reusing one purchase id mint distinct tokens (a real collision bug caught by the replay test and fixed in this commit).
- Renewal (D07/F-TIME): current owner only; new term starts at max(now, old expiry); purchased terms remain intact and contiguous (3-tranche scenario asserted); renewal after termination refunds.
- Plans are immutable once published (idempotent re-publish with identical terms only); new versions become `current_plan_version` and renewals use the current version's price.
- Plan preconditions: price > 0, 1 <= term_ms <= MAX_TERM_MS (10^12) are hard asserts.
- Prepaid native-NEAR storage (separate from FT price): purchase without prepaid storage refunds the FT amount and mints nothing; minting deducts exactly one minimum slot; withdraw releases only unbacked balance.
- F-VEST integration through contract state: gross 101, 10s term -> earned 50 / unvested 51 at 5s, fully vested at term end.
- Only the allowlisted FT may call ft_on_transfer (panics otherwise); unparsable messages panic (whole ft_transfer_call fails and resolves per standard).

## Honest limits

- Host-unit scope only: no NEAR sandbox run yet (near-workspaces is Unix-only; WSL Ubuntu available for KF-05d, covering N01-N12 incl. real FT integration and callback/promise behavior).
- Withdrawal payouts, termination/refunds, NFT transfer with access-epoch bumps, enumeration views: NOT implemented (KF-05c).
- STORAGE_BUFFER_BYTES = 2048 is an estimate for license/tranche/index records; must be verified against measured usage in sandbox evidence before any deployment.
- Nothing deployed; no testnet/mainnet action; no Codex ACCEPTED verdict for KF-05.
