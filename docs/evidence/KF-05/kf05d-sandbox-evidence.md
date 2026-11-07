# KF-05d evidence — NEAR sandbox tests (PASS_LOCAL, sandbox)

Task/Test ID: KF-05d (bounded): deployed-wasm sandbox verification on a real NEAR sandbox node — purchase mint + storage accounting, wrong-amount refund, termination freeze, REAL async payout callback failure/restore on-chain, refund claim with complement relation. Full N01-N12 matrix (real FT happy-path payout, N02 full FT resolver path, N09/N10 invariants) remains open until a testnet mock FT contract is deployed.

Commit + branch: see git log; branch main.
Environment: WSL Ubuntu 24.04, rustc/cargo 1.99.1 (installed 2026-11-07 for this task), near-workspaces 0.24.0 + near-sandbox node (local), serde_json dev-dep; Windows host built nothing here. Release wasm: SHA-256 6e977c101d77004a9543b86cff56698f5b382712c4d3f02d1d2915652ece5f7f (source-identical copy in WSL home; gitignored target dirs).
Commands: `cargo build --locked --release --target wasm32-unknown-unknown && cargo test --locked` (inside WSL). Host suite re-verified: 26/26.
Observed result: sandbox tests 3/3 PASS (plus host 26/26 in the same run):
- n01_exact_payment_mints_license_and_tranche: real ft_on_transfer from the designated FT account mints the license NFT (nft_token view shows owner), access_active true, epoch 1; storage_balance_of equals prepaid minus exactly one storage_minimum_balance slot — the 2048-byte buffer was NOT exceeded (measured usage fits).
- n02_wrong_amount_is_refunded_without_minting: mismatched amount returns the full amount; nothing minted.
- n06_termination_freezes_and_payout_failure_restores_on_chain: fast-forwarded chain, monitor terminates; claimable_of reflects partial vesting frozen at the real cutoff; trader ft_withdraw reserves the vested amount; the FT transfer promise FAILS (receiver has no contract) and the contract's own payout_callback restores the reservation ON-CHAIN (claimable returns to the exact pre-withdraw value; tranche withdrawn back to 0); owner claim_refund reserves the exact complement (refundable + claimable == 101) and the callback restores it after the same failure.
Classification: PASS_LOCAL (sandbox = local simulated chain; NOT testnet).

## Lessons fixed during this evidence run (kept in history)

- Sandbox rejects oversized contracts: debug wasm (13.7 MB) crashes the node; release wasm (514 KB) is required — tests now read the release artifact.
- Payout calls must attach explicit transaction gas (200 Tgas in tests): the prepaid tx gas covers the whole promise chain (ft_transfer 50 Tgas + callback 50 Tgas); the default was insufficient.
- near-sdk 5.30: trait impls need #[near] to export methods (nft_token/transfer/enumeration/metadata); promise_result_checked used per deprecation; payout promises are returned from methods (lint-caught dropped-promise bug).

## Honest limits

- The "FT" account is a plain account (no NEP-141 contract): payouts intentionally FAIL so the restore path is exercised; the SUCCESS path of ft_transfer + resolver needs a real/mock FT contract (next step, also required for G02 and the checklist in testnet-deployment-checklist.md).
- N01/N02 are exercised through direct ft_on_transfer calls from the designated FT account, not through a real ft_transfer_call resolver round-trip.
- fast_forward timing is not deterministic; exact F-VEST numbers stay in host tests, sandbox asserts relations (complement sums, restoration equality).
- No testnet deployment yet; nothing on any public network; no Codex ACCEPTED verdict for KF-05.
