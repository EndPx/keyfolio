# G02 reviewer-checkpoint evidence — FT integration in Sandbox (PASS_LOCAL-sandbox)

Date: 2026-11-07. Scope: reviewer findings 1-9 addressed; NO new testnet transactions or deployments (per instruction); all new verification ran on the LOCAL NEAR sandbox node (WSL).

## Reviewer findings -> resolution

1. **ft_metadata/ft_total_supply exports**: mock-ft now wraps `FungibleTokenCore::ft_total_supply` and the metadata provider impl is `#[near]`-exported. Verified two ways: export-name strings present in the release wasm, and both methods CALLED successfully on the deployed contract in sandbox (`ft_total_supply` == "1000000000000", `ft_metadata.name` contains "TEST"). New wasm sha256 79da31a6eca52f1e2c0d1d25eb209e49099485d566426cb11f72fc0c4ef887ad (268,055 bytes).
2. **MONITOR undefined**: deploy-ft.mjs now defines and uses MONITOR (terminate step).
3. **ACCESS registered on the FT**: both BUYER and the ACCESS contract are storage-registered before any transfer (in sandbox test and deploy-ft.mjs).
4. **callView/result shapes**: scripts verified against the installed near-api-js v6 (provider.query call_function + direct Account API); sandbox uses near-workspaces' typed view API.
5. **Success from receipts + deltas, not tx outcome alone**: both the sandbox test and deploy-ft.mjs assert per-receipt outcomes (failures fail loudly), require the `payout_settled` callback log, and assert exact FT balance deltas for funding, purchase (buyer -101 / access +101), payout (ops +101 / access -101) and refund.
6. **Positive refund mandatory**: mid-term termination must yield refundable > 0 or the test FAILS loudly; refund settles with exact deltas and refundable -> 0. The silent-skip `if (refundable !== '0')` branch was removed.
7. **Double init on deployed wasm**: both the access contract and the mock FT reject a second `new` on the deployed code (sandbox assertions; deploy-ft.mjs asserts the same on testnet when it runs).
8. **Tracked reproduction scripts**: create-accounts.mjs, deploy-access.mjs, deploy-ft.mjs now live in `scripts/testnet/` (tracked, with package.json). Signing keys remain outside Git (KEYS_DIR, default `.deploy-local/testnet-tools/keys`, gitignored). Scripts' syntax checked; create-accounts re-run verified the new location works.
9. **Status reconciled**: docs/status.md updated with the classifications below.

## NEW: happy-path FT integration (sandbox, PASS_LOCAL-sandbox)

`contracts/access/tests/sandbox_ft.rs` — deploys BOTH release wasm files to the sandbox and walks:
init both (T7 double-init rejection proven on both) -> register BUYER + ACCESS on FT -> fund buyer 10,000 -> buyer prepays access storage -> plan 101/10s -> **purchase via real `ft_transfer_call`** (resolver returns the SPENT amount "101" per NEP-141 neps/nep-0141.md — the earlier "0" assertion was a wrong polarity in MY test, not a contract bug; on_transfer correctly returned unused "0" and balances moved exactly) -> license + tranche verified -> fast-forward to full vest -> **ft_withdraw with a REAL successful FT payout** (payout_settled callback log present; owner +101, access -101, claimable -> 0) -> purchase #2 -> monitor terminates mid-term -> refundable in (0, 101) asserted -> owner-of-NFT claim_refund (payout_settled; buyer +refundable, access -refundable, refundable -> 0) -> token conservation (ft_total_supply unchanged).

Results: host 26/26; sandbox KF-05d 3/3; sandbox FT integration 1/1 — all green in one run.

## Classification

- PASS_LOCAL (sandbox): everything in this file.
- PASS_TESTNET (unchanged scope): access deploy/init/views/plan at keyfolio-access.testnet (tx 2BC64VGh…). The testnet FT smoke (deploy-ft.mjs) is aligned with these fixes but NOT yet executed — blocked on the faucet rate-limit window (429, ~4h remaining at 16:35 WIB) for keyfolio-usdc.testnet.
- Blockers: faucet window (testnet FT smoke); KF-05 still lacks independent Codex review before any ACCEPTED verdict.

## Honest limits

- Sandbox-only for the FT happy path; the same flow on testnet runs after the faucet window with the identical assertions in deploy-ft.mjs.
- Exact F-VEST numbers remain in host tests; sandbox timing uses a bounded vesting wait loop.
- Still NOT covered: N09/N10 randomized invariants, N02 full failed-purchase resolver refund on-chain (partial-acceptance path), approval flows (out of scope v1).
