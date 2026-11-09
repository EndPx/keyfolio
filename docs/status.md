# Keyfolio status

Updated:2026-11-09, Asia/Jakarta. Branch main, public https://github.com/EndPx/keyfolio. This reconciliation supersedes contradictory progress statements in prior versions; Git history/evidence preserve original failures and reports. Full project is NOT complete.

## Current assignment and authority

Primary Codex coordinates/reviews/integrates. User authorized Orca Codex Terra executor in KF-D016; historical DeepSeek C00 remains accepted. One implementation writer, no simultaneous migration/lockfile writer. The hydrated read-only TESTNET browser smoke and visual patch are accepted PASS_LOCAL; no active worker is pending in this checkout. Worker owns bounded implementation diffs/evidence; coordinator owns status/decisions/acceptance. Exact task/dispatch/handle remains in ignored local runtime notes.

No signing/connect-wallet action, faucet, account/key change, deployment, mainnet call or paid service authorized for this task. Existing baseline limits still apply. FigCraft-first design direction was approved by user before implementation. NEAR-first and testnet-first remain binding. Do not restart accepted tasks.

## Task states

| Task | Current result | Evidence / remaining scope |
|---|---|---|
| KF-00 | ACCEPTED PASS_LOCAL | Actual DeepSeek task/result/Codex review [C00](evidence/KF-00/codex-review.md); do not repeat |
| KF-01 | BLOCKED_EXTERNAL | No authorized source account/session/history invitation or subscriber-use approval. [Official research](evidence/KF-01/access-research.md), [UNSENT draft](provider-access-request.md). No repeat unauthed probes |
| KF-02 | PARTIAL | KF02a ACCEPTED source319a843,52 tests+CI. KF-02b API/OpenAPI/provider boundary PASS_LOCAL at current diff with 138 full workspace tests, but full foundation acceptance and API handlers remain incomplete |
| KF-03 | PASS_LOCAL subsets, not accepted full task | Domain ledger8979923; persistence2810aa9 event/movement/cursor transaction and CAS tests. Local recovery/reconciliation/correction integration and live account reconciliation incomplete |
| KF-04 | PASS_LOCAL domain, not full acceptance | Exact PnL/TWR/drawdown6bf9ef0. Historical price source G03, snapshots/public read model and pipeline not wired |
| KF-05 | IN_PROGRESS | Host contract and deployed-WASM Sandbox results reported in KF05 evidence, including mock FT happy path. Full N01-N12 review/testing not accepted. Testnet deployment records conflict; see below. No purchase/payout testnet acceptance |
| KF-06 | PASS_LOCAL domain, not full acceptance | Challenge/binding/nonce/credential/quota pure rules65d5ba7. Real signature/account-key verification, durable sessions/CSRF/hash/API integration missing |
| KF-07 | NOT_RUN integration | Requires real auth plus authoritative owner/epoch/expiry/pending transfer/freshness checks, credential invalidation and private request tests |
| KF-08 | PASS_LOCAL accepted slices, landing-first redesign queued | User-approved FigCraft dashboard and new landing direction exist. Checkout preflight/recovery bd6c9b0 and browser smoke are accepted only for source/read-only scope; [acceptance](evidence/KF-08/checkout-preflight-acceptance.md). Wallet signing/purchase/private entitlement remain unproven. Other screens not full U01-U06 acceptance |
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

Visual patch checkpoint (2026-11-09): PASS_LOCAL. Existing `assets/brand/keyfolio-symbol-v1.png` is copied byte-for-byte to `apps/web/public/brand/keyfolio-symbol-v1.png` and used by `SideNav` with fixed dimensions and decorative alt handling; the same master is exposed as `apps/web/src/app/icon.png` to remove the favicon 404. The missing `--ink38` token and TESTNET `dot-live` color are defined; one verbatim duplicate gate CSS block is removed. Responsive shell behavior and KF-D016 mode/honesty/account-following contracts are unchanged. Evidence: [visual-patch-2026-11-09](evidence/KF-08/visual-patch-2026-11-09.md). Validation: `pnpm --filter @keyfolio/web typecheck`, `pnpm --filter @keyfolio/web build` PASS_LOCAL.

KF-02b checkpoint (2026-11-10): PASS_LOCAL implementation reviewed by Codex. Frozen 14-route section-11 browser contract, deterministic OpenAPI artifact, server-only provider adapter boundary, and FIXTURE-only synthetic adapter are present. TESTNET/LIVE adapters fail closed pending KF-01/G01. Validation: `pnpm check` **138/138 PASS**. Evidence: [kf02b-implementation-evidence](evidence/KF-02/kf02b-implementation-evidence.md).

KF-D017 UI checkpoint (2026-11-10): FigCraft landing contract added as `Screen / 00 Landing desktop 1440`; landing-first motion and rounded dashboard surfaces are now binding. Production landing implementation and wallet CTA wiring are the next frontend slice; no signing or deployment is implied.

KF-08 landing checkpoint (2026-11-10): PASS_LOCAL implementation reviewed. Root `/` is now a motion-led landing page; Marketplace moved intact to `/marketplace`; existing NEAR Wallet Selector is reused with FIXTURE simulation, TESTNET connect/sign-in states and LIVE fail-closed behavior. Browser evidence covers 1440px, 390px and reduced-motion 390px with zero overflow; final workspace validation is **140/140 tests PASS**. Evidence: [landing-first-implementation](evidence/KF-08/landing-first-implementation.md). TESTNET signing, purchase, private entitlement and live performance remain unproven.

KF-D018 checkpoint (2026-11-10): landing and app separation is now binding. The current landing implementation remains a reviewed prototype in `apps/web` while the next UI slice extracts it into `apps/landing`; `apps/web` will return to the dashboard/app shell. The landing 70/20/10 narrative and choose-trader → NFT-key → private/API → assisted-copy scenario are documented in DESIGN.md and decisions.md.

KF-06a checkpoint (2026-11-10): PASS_LOCAL implementation reviewed. Server-only auth service now provides fail-closed challenge/verify, nonce consumption, secure session/CSRF/logout seam, hashed display-once credentials with cap/revoke and shared quota. In-memory store is test-only; PostgreSQL persistence and real wallet verifier remain next gates. Validation: `pnpm check` **143/143 PASS**. Evidence: [kf06a-implementation-evidence](evidence/KF-06/kf06a-implementation-evidence.md).

KF-D018 implementation checkpoint (2026-11-10): PASS_LOCAL separation reviewed. `apps/landing` now owns the marketing surface with its own nav/layout/wallet seam; `apps/web` root is the dashboard Marketplace and keeps `/marketplace` as an explicit alias. Landing browser evidence covers 1440px, 390px, reduced motion and 375/390/768/1280/1440 overflow checks with no app sidebar/banner leakage. Full workspace validation: **144/144 tests PASS**. Evidence: [landing-separation-implementation](evidence/KF-08/landing-separation-implementation.md). Wallet signing and live execution remain unproven.
