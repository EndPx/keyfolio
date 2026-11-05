# Keyfolio status

Updated: 2026-11-06, Asia/Jakarta. Repository: https://github.com/EndPx/keyfolio (PUBLIC), branch main. Opened checkout had no files or Git history; no user edits were overwritten. Initial documentation commit is the current bootstrap; use git log for exact SHA rather than embedding a self-referencing commit.

## Current milestone

Continue the current KF-02a implementation, review/test/revise/commit/push, then automatically advance through dependency-ready tasks up to KF-11 under KF-D011. Public repo/planning bootstrap and C00 are accepted; do not restart. Source access remains a separate external gate.

| Task | State | Evidence / limit |
|---|---|---|
| KF-00 | ACCEPTED | C00 PASS_LOCAL: actual DeepSeek task, returned result/report, independent Codex arithmetic/hash assertions and settled worker_done reviewed |
| KF-01 | BLOCKED_EXTERNAL | Initial official-doc review and no-auth HTTP probes recorded; authenticated S01-S08 NOT_RUN |
| KF-02 | BLOCKED_EXTERNAL | KF-02a revision01 passed47/47 and key independent probes; final small revision interrupted by GATER403 ip_limit_reached. Partial source preserved; current health subset7pass/1fail; NOT ACCEPTED |
| KF-03..KF-11 | TODO | No implementation acceptance |

Codex owns docs, schema/interface decisions, review and integration. Attempt01 failed at readiness and was released. Attempt02 reported input_accepted but actual worker-read revealed a first-run onboarding wizard; it never executed C00. Guarded worker-stop confirmed closure, then the installed TUI preference helper recorded setup-guide completion while retaining model/credentials. Attempt03 completed C00 and worker_done/worker-show reconcile succeeded/settled. [Codex review](evidence/KF-00/codex-review.md) accepts total43, retained3, duplicate1 and exact fixture SHA-256 after independent Python assertions. No funds/deployments/third-party messages performed.

KF-02a ownership: DeepSeek owns root workspace/lockfile, packages/domain, packages/api-contract, apps/api, apps/worker, initial API-owned migration/test scripts and its evidence. Codex owns status/decisions/design docs and acceptance. No concurrent migration/lockfile writer. [Review01](evidence/KF-02/codex-review-01.md) failures were fixed and independently checked. [Review02](evidence/KF-02/codex-review-02.md) records47-pass prior-revision evidence, last24h/threshold correction and interrupted current test state. Open follow-up is errored on provider access, not completed; no worker_done received for it. Implementation remains uncommitted until final acceptance. Exact runtime IDs are in ignored local notes.

## Runtime inventory

Verified locally: Node24.18.0; pnpm10.21.0; rustc1.99.0; cargo1.99.0; GitHub CLI authenticated as EndPx. Proven executor: DeepSeek Harness0.2.1-rc.5 with TUI0.18.0, `gater/deepseek-v4.1-flash-1017-v2`, endpoint host api.gater.ai.id. C00 demonstrated model task execution, returned artifacts and Codex review. Saved GATER credential resolves through the shared Harness credential store; no credentials displayed or committed. Configuration is stable; do not reconfigure/retest absent a new failure.

Resolved startup history: TUI0.17.0 was incompatible; upgraded to0.18.0 and matching hooks0.2.1-rc.5 without compatibility exemptions or Harness downgrade. First-run onboarding was completed before the successful C00 attempt. Failed attempts remain in evidence; they are not current blockers. Multiple Orca workspace records share this checkout; use the existing exact selector from local runtime notes.

Credential-resolution correction is closed: saved `refs` take precedence over environment fallback. Earlier records-only inspection missed the saved reference. C00 subsequently proved execution; no credential action is pending for GATER.

## External gates

- G01: user confirms no selected trader test account and no history invitation/access confirmation. [Official access research](evidence/KF-01/access-research.md) separates partner identity, owner session and unconfirmed invitation granularity/coverage. [Unsent request draft](provider-access-request.md) asks for invitation, environment, complete account coverage and subscriber-use rights. No repeated unauthenticated probes or provider messages. Initial reachability evidence is historical only, not authenticated access.
- G02: actual subscription FT/network/decimals/storage behavior unknown.
- G03: historical price provider not selected.
- G04: dependency versions and real wallet signing path not accepted.
- G05: live account, budgets, fees/destinations and signing route not authorized.
- Public paid use of vesting/refund/monitor still awaits user decision; local tests authorized.

Required future configuration names (not values): DATABASE_URL, KEYFOLIO_MODE, NEAR_NETWORK, NEAR_RPC_URL, ACCESS_CONTRACT_ID, SUBSCRIPTION_FT_CONTRACT_ID, PROVIDER_BASE_URL, PROVIDER_PARTNER_JWT (if required), TOKEN_ENCRYPTION_KEY, CREDENTIAL_HASH_KEY, SESSION_SECRET, APP_ORIGIN. Provider user-session/refresh tokens belong to encrypted connection storage after wallet proof, not NEXT_PUBLIC variables or committed env files. Exact provider requirements remain under KF-01 verification.

## Next bounded outcomes

1. DONE: public repo, reviewed documentation/asset bootstrap, byte-identical baseline and GitHub main verified.
2. DONE:C00 accepted after actual GATER/DeepSeek Flash result and independent review. Latest accepted evidence points to the reviewed fixture, not just a launch receipt.
3. KF-01 remains blocked on an authorized account signing route, User-Session/history invitation, and subscriber data reuse permission; do not repeat no-auth probes as access verification. Existing report records the known limits.
4. Receive/review KF-02a source, build and actual PostgreSQL-engine amount-test evidence including1.5; send revisions via its dispatch mailbox, accept/commit/push only reviewed files. No full KF-02 claim from this first slice. Next KF-02b completes missing minimal web/contract test layout and API/interface freeze before KF-05/KF-06. KF-D009/KF-D010 govern amounts/termination cutoff.
5. After each accepted task choose the next ready task automatically. KF-01 next action is user review/sending or explicit authorization of the unsent provider inquiry; no need to select/fund B before the provider identifies a suitable environment. Provider permission and actual account access remain separate acceptance requirements. Wallet signing stays with user; no keys/tokens in chat.

Target:14 November2026 23:59 WIB internal. Date is not a live-readiness guarantee. Risk: account-wide live ingestion/copy acceptance cannot be forecast until history access, source permissions and authorized account testing are available. Continue independent local work; do not imply that local tests resolve that risk. Next checkpoint is KF-02a source/test review.
