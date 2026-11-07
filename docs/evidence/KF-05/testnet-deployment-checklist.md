# Testnet deployment checklist (KF-05d/G04/G05 prep — prepared 2026-11-07)

Status: PREPARED, not executed. Deployment waits for sandbox evidence (KF-05d) and this checklist being walked through with its outputs recorded. Testnet-first per KF-D013; wallet/account creation via near CLI was authorized by the user (2026-11-07). No mainnet action is authorized.

## 0. Preconditions (must all be PASS before deploying)

1. Host tests: 26/26 `cargo test --locked` PASS_LOCAL (done).
2. Sandbox tests in WSL (N01/N02/N06 subset): PASS before deployment (this milestone).
3. Storage buffer (STORAGE_BUFFER_BYTES = 2048) verified against measured per-token usage from sandbox evidence; adjust constant if measured usage exceeds it.
4. Remaining known gaps documented and accepted for testnet scope: payouts target the allowlisted FT (testnet mock FT must implement NEP-141 incl. ft_transfer_call resolver); no mock FT was deployed in the first sandbox pass (recorded as remaining).

## 1. Accounts (created via near CLI, keys in local keychain, never committed)

| Role | Account | Notes |
|---|---|---|
| Operator/owner | `keyfolio-ops.testnet` (implicit-account alternative recorded if used) | Calls set_plan/set_sales_enabled |
| Monitor | `keyfolio-monitor.testnet` | terminate_service only |
| Subscription FT (testnet mock) | `keyfolio-usdc.testnet` | Must be a real NEP-141 contract incl. ft_transfer_call resolver |
| Buyer / follower A | dev/test wallet | signs purchase (ft_transfer_call) |
| Trader B | dev/test wallet | withdraws vested earnings |
| Recipient C | dev/test wallet | NFT transfer epoch test |

Creation command shape (run by session under user authorization): `near account create-account use-faucet --newAccount <name> --type implicit --networkId testnet` (exact flags per installed near-cli version — verify with `near --version` first; never paste keys anywhere).

## 2. Build & deploy

1. `cargo build --locked --release --target wasm32-unknown-unknown` (release build; record SHA-256 of the wasm in evidence).
2. Deploy: `near contract deploy <contract-account> --wasmFile access.wasm --networkId testnet` then initialize: `new` with owner/monitor/ft ids (exact flag names per installed CLI).
3. Record: deploy tx hash, block height, wasm hash, init args in `docs/evidence/KF-05/testnet-deploy-evidence.md`.

## 3. Post-deploy testnet smoke (each step = one evidence row)

1. `contract_info` view matches intended config.
2. `set_plan` by owner; wrong caller must fail.
3. Buyer: FT `storage_deposit` on the FT + prepaid `storage_deposit` on the access contract; purchase via real `ft_transfer_call` with msg; verify NFT + tranche + exact-price refund path with a wrong amount.
4. Vesting sanity: `claimable_of`/`refundable_of` relations (sum == price) at two block heights.
5. `terminate_service` by monitor; withdraw (success path with a REAL FT now) then refund claim; transfer epoch A→B via `nft_transfer_call` with a receiver that rejects.

## 4. Costs (testnet, faucet-funded; record actuals)

- Contract deploy storage stake: measured after deploy (expect tens of NEAR staked, not spent).
- Per-call gas: record burnt gas from each evidence row.
- Faucet limits: create accounts with the minimum; no real funds involved.

## 5. Rollback / cleanup

- The access contract holds FT liabilities only on testnet mock funds; cleanup = burn/ignore.
- Re-deploy same account overwrites code; keep the wasm hash per version for traceability.
- Nothing here authorizes mainnet. Mainnet remains gated by explicit user authorization (G05).
