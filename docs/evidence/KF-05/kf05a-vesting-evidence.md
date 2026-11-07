# KF-05a evidence — vesting helper only (PASS_LOCAL)

Task/Test ID: KF-05a (vesting arithmetic). This is NOT KF-05 acceptance; contract state and money flows are still TODO (KF-05b/c/d).

Commit + branch: see git log for the commit carrying this file; branch main.
Environment: local Windows host; cargo 1.99.0; near-sdk 5.30.1, near-contract-standards 5.30.1; deps resolved with Cargo.lock (`--locked`).
Command or steps:
- `cargo test --locked` (contracts/access) — host unit tests
- `cargo check --locked --target wasm32-unknown-unknown` — contract target compiles

Expected result: F-VEST fixture exact values; u128 boundary behavior; floor division correctness; duration precondition enforced; results never exceed gross and are monotonic.
Observed result: 6/6 tests pass (first run caught one wrong hand-computed expectation, floor(101*1/10000)=0 not 10; corrected the test, not the implementation). wasm32 check finished clean.
Classification: PASS_LOCAL.

Design note: implementation uses divide-before-multiply split (gross = q*d + r; earned = q*e + floor(r*e/d)) — no widened math needed. Safety: q*e <= gross for e <= d; r*e < d^2 <= 10^24 under the MAX_TERM_MS = 10^12 ms precondition, which is asserted (panic, not clamp). F-VEST verified: gross 101, term 10s, at 5s -> earned 50, unvested 51; at term end earned 101.

Reviewer: self-review only (session). Independent expected values used in tests are hand-computed (1000/3 cases, 7/3 cases, MAX - ceil(MAX/10^12)); no independent reviewer yet.
Remaining limits: no contract state; no purchase/renewal/payout/termination flows; no NEAR sandbox tests run yet (near-workspaces is Unix-only; WSL Ubuntu available); nothing deployed; no Codex ACCEPTED verdict for KF-05.
