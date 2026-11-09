# Keyfolio status

Updated:2026-11-09, Asia/Jakarta. Branch main, public https://github.com/EndPx/keyfolio. This reconciliation supersedes contradictory progress statements in prior versions; Git history/evidence preserve original failures and reports. Full project is NOT complete.

## Current assignment and authority

Primary Codex coordinates/reviews/integrates. User authorized Orca Codex Terra executor in KF-D016; historical DeepSeek C00 remains accepted. One implementation writer, no simultaneous migration/lockfile writer. Current Terra task: hydrated read-only TESTNET browser smoke for checkout/keys/studio and bounded runtime blockers; ready receipt names gpt-6.1-terra. Await actual results. Worker owns web/verification scripts/tests and new KF08 evidence; coordinator owns status/decisions/acceptance. Exact task/dispatch/handle in ignored local runtime notes.

No signing/connect-wallet action, faucet, account/key change, deployment, mainnet call or paid service authorized for this task. Existing baseline limits still apply. FigCraft-first design direction was approved by user before implementation. NEAR-first and testnet-first remain binding. Do not restart accepted tasks.

## Task states

| Task | Current result | Evidence / remaining scope |
|---|---|---|
| KF-00 | ACCEPTED PASS_LOCAL | Actual DeepSeek task/result/Codex review [C00](evidence/KF-00/codex-review.md); do not repeat |
| KF-01 | BLOCKED_EXTERNAL | No authorized source account/session/history invitation or subscriber-use approval. [Official research](evidence/KF-01/access-research.md), [UNSENT draft](provider-access-request.md). No repeat unauthed probes |
| KF-02 | PARTIAL | KF02a ACCEPTED source319a843,52 tests+CI. Full API/OpenAPI freeze and provider boundary still missing; old GATER assignment not active. Web/contract scaffolds now exist, full foundation acceptance not established |
| KF-03 | PASS_LOCAL subsets, not accepted full task | Domain ledger8979923; persistence2810aa9 event/movement/cursor transaction and CAS tests. Local recovery/reconciliation/correction integration and live account reconciliation incomplete |
| KF-04 | PASS_LOCAL domain, not full acceptance | Exact PnL/TWR/drawdown6bf9ef0. Historical price source G03, snapshots/public read model and pipeline not wired |
| KF-05 | IN_PROGRESS | Host contract and deployed-WASM Sandbox results reported in KF05 evidence, including mock FT happy path. Full N01-N12 review/testing not accepted. Testnet deployment records conflict; see below. No purchase/payout testnet acceptance |
| KF-06 | PASS_LOCAL domain, not full acceptance | Challenge/binding/nonce/credential/quota pure rules65d5ba7. Real signature/account-key verification, durable sessions/CSRF/hash/API integration missing |
| KF-07 | NOT_RUN integration | Requires real auth plus authoritative owner/epoch/expiry/pending transfer/freshness checks, credential invalidation and private request tests |
| KF-08 | PASS_LOCAL accepted source slice, browser validation running | User-approved FigCraft direction and web pages exist. Checkout preflight/recovery bd6c9b0 accepted only source/test scope; [acceptance](evidence/KF-08/checkout-preflight-acceptance.md). Browser hydration/signing/purchase remain unproven. Other screens not full U01-U06 acceptance |
| KF-09 | NOT_RUN | Assisted-copy order/quote/source signing/status adapter not implemented; actual execution requires G01/G05 |
| KF-10 | NOT_RUN | Full journey/recovery/backup/secret audit not accepted; no end-to-end claim |
| KF-11 | NOT_RUN | Final reproducible release/evidence/demo/rollback package follows integration; maintain accurate partial README meanwhile |

## Evidence truth and conflicts

Accepted checkout source bd6c9b0: Codex independent full132-test prior revision + focused final17-test classifier; executor final133 suite/build/typecheck/mode-matrix report. --test-force-exit is a recorded PGlite teardown workaround, not evidence of normal cleanup. Unit/server HTML tests are not browser hydration. Private account/API data remain unimplemented beyond explicitly labeled fixtures/gates; public owner lookup is not authenticated private access.

Testnet access deployment has conflicting evidence: testnet-deploy-evidence.md was marked INVALID based on one provider observation, but independent prior RPC review and later DeepSeek public-read report observed contract_info and101atomic/10second plan at keyfolio-access.testnet. Do not resolve this by assuming accounts never existed or redeploying/wiping. Terra now validates hydrated public-read behavior; capture endpoint/finality/block/actual views and label inconsistency. FT keyfolio-usdc.testnet was UNKNOWN_ACCOUNT in latest worker observation; current availability must be read before a purchase test. Historical faucet429/reset-time estimates are not a current availability guarantee. Do not poll faucet.

No live Confidential Intents ingestion/performance, complete wallet signing, private API access or full source-to-copy journey has been accepted. Sandbox/PGlite are PASS_LOCAL only; mixed-network results remain PARTIAL_INTEGRATION.

## External gates and minimum user actions

- G01: approve/send unsent provider inquiry or authorize sending; provider must confirm invitation scope, account-wide/external-interface coverage, timestamps and paid subscriber/API reuse/retention. Select/sign a test account only after supported environment is clear. No secrets in chat.
- G02: mock FT source exists, public testnet FT availability remains unproven. No new deployment/account funding from current task; prepare exact action/accounts/budget for missing authorization if required.
- G03: NEAR-first historical pricing capability/asset coverage unresolved. Current oracle price does not establish historical cash-flow valuations. No paid service selected.
- G04: wallet SDK wired/tested synthetically but actual user signing and server ownership verification incomplete. Owner/public-wallet labels cannot substitute for proof.
- G05: real-asset spend/mainnet deployment and paid public vesting/refund/monitor use still require explicit approval. Testnet-first does not authorize arbitrary key changes/deployment.
- GATER failures are historical executor-provider limits; current Terra authorized explicitly, so they do not block independent source work. Do not revive old GATER tasks concurrently.

## Delivery queue

1. Finish Terra hydrated read-only browser smoke, review/fix/test, commit/push accepted result.
2. Complete shared API/schema and source-capability boundary locally, then wire real wallet challenge/session/credential security and NFT-gated reads. Keep one schema/lockfile owner; use explicit synthetic adapters only in FIXTURE.
3. Continue local ledger persistence/corrections/reconciliation and public performance projection using qualified synthetic prices while G01/G03 actual acceptance blocked.
4. Review/close contract acceptance gaps and integrate approved UI screens. Prepare exact testnet purchase/signing prerequisite steps; user controls wallet. No repeated polish-only cycles; fix real blockers.
5. Assisted-copy/recovery pipeline and final integration/release proof; advance dependency-ready local tasks automatically, retain live gates as BLOCKED_EXTERNAL rather than claiming full completion.

Internal target2026-11-14 23:59 WIB. Schedule is at risk: full foundation/API/auth integration and actual source permissions remain incomplete with five days left. No scope/tests silently removed; report exact blocked scope if complete end-to-end evidence cannot be achieved. Worker done is IMPLEMENTED, coordinator acceptance requires review.


Terra browser smoke accepted PASS_LOCAL read-only: real Chrome at1440/390 executed checkout/keys/studio, bounded RPC timeout error/retry, no mobile overflow, no signing. Evidence:[browser-smoke-acceptance](evidence/KF-08/browser-smoke-acceptance.md). Wallet signing/purchase/private entitlement remain NOT_RUN; FT/G02 and source/G01 remain blockers.
