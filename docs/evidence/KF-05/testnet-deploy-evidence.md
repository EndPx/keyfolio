# Testnet deployment evidence — access contract (PASS_TESTNET scope: deploy/init/views/plan)

Date: 2026-11-07. Executor: this session (user mandate KF-D013 + "kerjakan semuanya"; wallet creation via near CLI / faucet API authorized 2026-11-07). NO mainnet action.

## Accounts (testnet; keys in local keychain/.deploy-local/keys/, never committed)

- keyfolio-ops.testnet — operator/owner (created)
- keyfolio-monitor.testnet — monitor (created)
- keyfolio-access.testnet — contract account (created; balance 10 NEAR from faucet)
- keyfolio-usdc.testnet — future mock-FT holder (NOT created yet: faucet rate limit 429, retry window 8h; referenced as ft_id only)

Tooling note: near-cli-rs 0.31.1 (checksum-verified) proved interactive-only for these flows (block-selection/facet prompts deadlock non-TTY pipes even with --quiet), so the same public testnet faucet service (helper.testnet.near.org/account — the classic helper endpoint, body {newAccountId,newAccountPublicKey}) was called programmatically via near-api-js v6 scripts in .deploy-local/testnet-tools/ (create-accounts.mjs, deploy.mjs). Same keys, same network, no credentials printed.

## Deployment

- wasm: release build of contracts/access (582,307 bytes), SHA-256 80d1340207c7e14c0162c5d63d4374e58c58c0c67db0890c18c1e4f825adf9cf
- deploy tx: 2BC64VGh7A5AiXmcC7FEvUguqgA9zGk1uxs4DYikiVJ9 (account keyfolio-access.testnet signs its own deploy; no separate deploy key was created)
- init `new`: owner_id=keyfolio-ops.testnet, monitor_id=keyfolio-monitor.testnet, ft_id=keyfolio-usdc.testnet (placeholder holder until the mock FT contract is deployed)

## Observed on-chain results

- contract_info view: {"version":"kf-05c-wip","owner_id":"keyfolio-ops.testnet","monitor_id":"keyfolio-monitor.testnet","ft_id":"keyfolio-usdc.testnet"}
- access account balance after deploy+init: 9.99541568061894 NEAR (10 NEAR faucet minus fees; the observed balance did NOT drop by the expected ~5.8 NEAR storage stake — recorded as an open observation to reconcile, possibly a v6 deploy path detail)
- set_plan (signed by keyfolio-ops): version 1, price "101" atomic, term_ms 10_000 (F-VEST fixture plan for smoke)
- get_current_plan view: {"price":"101","term_ms":10000,"active":true}

## Classification

PASS_TESTNET for: account provisioning, wasm deployment, initialization, owner-gated plan publishing, public views on real testnet RPC.
NOT covered yet (next milestones): FT-less smoke limits — purchase/renewal/payout flows need keyfolio-usdc.testnet to exist plus a real NEP-141 mock FT contract (ft_on_transfer can only be called by the FT account; payouts call ft_transfer there). Also pending: N02 full resolver path, N09/N10 invariants on-chain, storage-stake reconciliation observation.

## Rollback

Testnet-only funds; contract can be redeployed/ignored. Nothing here authorizes mainnet (G05) or real funds.
