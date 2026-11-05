# Keyfolio status

Updated: 2026-11-06, Asia/Jakarta. Repository: https://github.com/EndPx/keyfolio (PUBLIC), branch main. Opened checkout had no files or Git history; no user edits were overwritten. Initial documentation commit is the current bootstrap; use git log for exact SHA rather than embedding a self-referencing commit.

## Current milestone

Establish public repo, immutable handoff, binding decisions, design system, architecture and logical database/chain placement; prove DeepSeek Harness/GATER/Flash execution via Orca; then prioritize Confidential Intents capability verification and independent KF-02 foundation.

| Task | State | Evidence / limit |
|---|---|---|
| KF-00 | ACCEPTED | C00 PASS_LOCAL: actual DeepSeek task, returned result/report, independent Codex arithmetic/hash assertions and settled worker_done reviewed |
| KF-01 | BLOCKED_EXTERNAL | Initial official-doc review and no-auth HTTP probes recorded; authenticated S01-S08 NOT_RUN |
| KF-02 | RUNNING | KF-02a dispatched to DeepSeek Harness/Flash through Orca; ready/input accepted; source implementation and test results pending review |
| KF-03..KF-11 | TODO | No implementation acceptance |

Codex owns docs, schema/interface decisions, review and integration. Attempt01 failed at readiness and was released. Attempt02 reported input_accepted but actual worker-read revealed a first-run onboarding wizard; it never executed C00. Guarded worker-stop confirmed closure, then the installed TUI preference helper recorded setup-guide completion while retaining model/credentials. Attempt03 completed C00 and worker_done/worker-show reconcile succeeded/settled. [Codex review](evidence/KF-00/codex-review.md) accepts total43, retained3, duplicate1 and exact fixture SHA-256 after independent Python assertions. No funds/deployments/third-party messages performed.

KF-02a ownership: DeepSeek gets root workspace/lockfile, packages/domain, packages/api-contract, apps/api, apps/worker, initial API-owned migration/test scripts and KF-02 evidence. Codex retains status/decisions/design docs and acceptance. No concurrent migration/lockfile writer. Exact dispatch references are in ignored `.deploy-local/orca-runtime.md`.

## Runtime inventory

Verified locally: Node24.18.0; pnpm10.21.0; rustc1.99.0; cargo1.99.0; GitHub CLI authenticated as EndPx. DeepSeek Harness0.2.1-rc.5 is installed. Desktop configuration and user screenshot identify `gater/deepseek-v4.1-flash-1017-v2`, endpoint host api.gater.ai.id, credential environment name GATER_API_KEY. CLI dsh-tui originally selected the official provider; its two relevant model/provider patch entries have now been aligned to the existing desktop configuration, preserving an ignored local backup. Composed CLI routing verified, authenticated generation still NOT_RUN. No credentials displayed or committed.

A dsh-tui help boot reported missing @deepseek-ai/dsh-hooks-claude-code. Initial installer attempt with its stale latest-tag0.0.1-rc.5 was rejected. Registry version discovery then found the matching0.2.1-rc.5, which installed successfully. Actual Orca launch proved its older TUI0.17.0 profile plugin incompatible; launcher and profile upgraded to0.18.0 with supported compatibility declarations. No risk exemption or Harness downgrade applied. Profile composition now includes TUI and hooks; runtime task execution still unproven. Multiple Orca workspace records share this checkout; inspected and used an exact selector.

Correction after inspecting the installed credentials-local implementation: saved refs take precedence over environment fallback. The Harness credential store contains a nonempty GATER_API_KEY reference in `refs`; the initial check inspected `records` only and therefore incorrectly treated the missing environment variable as an unresolved credential prerequisite. No key was displayed, copied to the repo or rewritten. CLI and desktop share the default Harness credential store. Credential presence and configured routing are now verified; actual model task execution still needs C00. Preserve the original failed Task and use its recorded recovery chain for retry.

## External gates

- G01: account history invite/access, authorized source account ownership proof, data redistribution permission, coverage of outside-Keyfolio activity, complete monetary events and trusted execution timestamps. No authorized source session is present in this repo. Safe unauthenticated GET probes observed balances401/history403; see docs/evidence/KF-01/initial-capability-report.md. These do not establish account access.
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
4. Prepared KF-02a bounded implementation brief: runnable API/worker/domain/contracts, strict API+PostgreSQL TEXT-domain amount checks including1.5, explicit environment modes. Delegate immediately after C00 review; no full KF-02 completion claim from this first slice. KF-D009/KF-D010 govern amounts and termination cutoff.

Target:14 November2026 23:59 WIB internal. Date is not a live-readiness guarantee. Next decision checkpoint: executor proof and source capability result; escalate source-history gate promptly rather than inventing app-only coverage.
