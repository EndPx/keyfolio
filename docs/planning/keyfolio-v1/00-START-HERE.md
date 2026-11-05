# Keyfolio: Orca execution handoff

Version: 1.0, prepared 2026-11-06, timezone Asia/Jakarta.
Delivery target: 2026-11-14 23:59 WIB. This is an internal end-of-day interpretation of the user's date, not a promised outcome or the hackathon cutoff.

## Read order and authority

1. This file: mission and startup.
2. `01-PRODUCT-AND-ENGINEERING-SPEC.md`: authoritative product requirements and implementation defaults.
3. `02-TASKS-AND-ACCEPTANCE.md`: task graph, tests, release evidence.
4. `03-CODEX-DEEPSEEK-PROTOCOL.md`: worker contract and coordination.

These files are a proposed executable baseline approved for planning, not evidence of implementation. When the user sends this packet with an instruction to build, local implementation is authorized. Merely receiving or reading it is not authorization to spend funds, publish, deploy mainnet, or contact third parties.

Latest explicit user instructions override this packet. Product behavior lives in file 01; task status must not silently redefine it. Codex may resolve routine implementation details and record them in `docs/decisions.md`. Changes to account coverage, money authority, customer rights, or required scope require a specific decision from the user. Missing external capabilities remain UNKNOWN or BLOCKED, never guessed.

## Mission

Build Keyfolio: trader wallet B authorizes access to its NEAR Confidential Intents trading account; follower wallet A buys a NEAR Access NFT; A authenticates ownership and reads B's account activity through the Keyfolio dashboard and API. Public account performance is derived from reconciled data. Assisted copy uses A's separate funds and fresh approval.

The product is account-following. A strategy description is optional profile text, not a separate portfolio that replaces B's account. Do not narrow this to trades placed through Keyfolio without user approval.

Coordination: Codex is architect, planner, integration owner, and acceptance reviewer. DeepSeek is the implementation executor through Orca. Do not substitute another model and call it DeepSeek. Exact installed provider/model/agent identifiers must be discovered in the receiving environment.

## First Codex turn in the receiving workspace

1. Read all four files and applicable existing repository instructions.
2. Verify the target directory and git status. Use the explicitly opened project when unambiguous. If there is no project destination, ask for the target path; do not choose an unrelated repository. Preserve existing edits.
3. Inventory existing code, runtimes, package manager, wallet integration, deployment setup, and tests. Do not scaffold over an existing implementation.
4. Resolve the Orca executable using installed skill instructions; load its current `orca-cli` and `orchestration` guides. Read the DAG reference if using task DAG commands. Do not use remembered CLI syntax when the installed version disagrees.
5. Identify the actual DeepSeek runtime/provider/model without printing credentials. Run a bounded, nonfinancial worker task that reads a small fixture, computes an expected result, and reports it. Confirm model identity from configuration/launch metadata, prompt receipt, worker completion, and Codex review.
6. Create `docs/decisions.md`, `docs/status.md`, and `docs/evidence/` in the target repo. Copy this packet to `docs/planning/keyfolio-v1/` without changing its meaning.
7. Start KF-01 and KF-02. Scaffold only the foundation needed for their results and the independent contract/API work.

Startup report must contain repository path, branch, dirty files preserved, runtime versions, confirmed DeepSeek execution route, required credential names (not values), dependency blockers, first task assignments, and next decision time.

## Authorization boundary

Allowed after a build instruction: inspect, edit local code/docs, install ordinary project dependencies, run local/sandbox tests, create isolated Orca workspaces where needed, and create reviewed local commits excluding secrets/unrelated changes.

Not granted by this document: remote push/publication, paid services, mainnet deployments, transactions spending real assets, changing wallet keys, sending messages to providers, or hackathon submission. Prepare exact action/recipient/network/value/max fee and request only the missing authorization. Existing explicit user authorization remains valid within its scope.

Testnet deployment also needs the selected account and its authorized signing route; never reuse production keys. Missing credentials block dependent live tests, not independent local work.

## Delivery truth

Use exactly these result classes:
- PASS_LOCAL: fixtures/sandbox only.
- PASS_TESTNET: testnet receipts plus verified outcomes.
- PASS_LIVE: permitted real provider/mainnet action with receipts and reconciliation.
- BLOCKED_EXTERNAL: required access, service capability, or authorization absent.
- FAILED: observed behavior contradicts an acceptance test.
- NOT_RUN: no execution evidence.

Two successful pieces on different networks do not prove one end-to-end flow. Mixed-network evidence is PARTIAL_INTEGRATION in the final release report. Never claim full completion because the date arrived.

## Ready-to-paste instruction for Codex in Orca

> Read all four files in this Keyfolio handoff packet. Act as the coordinator and acceptance reviewer; use the actual DeepSeek executor through Orca for implementation. Inspect the repository first and preserve existing work. Execute KF-00 onward in dependency order, carrying independent tasks forward while external access is blocked. Follow the product requirements, test IDs, and authority limits exactly. Prove the DeepSeek task/result/review loop before large delegation. Keep progress and evidence in docs/status.md and docs/evidence/. Target a reviewed release by 14 November 2026, 23:59 WIB. Ask only for decisions, credentials, or external actions that cannot be resolved from this packet and the current workspace. Do not silently reduce account coverage, fabricate provider capabilities, or substitute fixtures for live evidence.
