# Keyfolio status

Updated: 2026-11-06, Asia/Jakarta. Repository: https://github.com/EndPx/keyfolio (PUBLIC), branch main. Opened checkout had no files or Git history; no user edits were overwritten. Initial documentation commit is the current bootstrap; use git log for exact SHA rather than embedding a self-referencing commit.

## Current milestone

Establish public repo, immutable handoff, binding decisions, design system, architecture and logical database/chain placement; prove DeepSeek Harness/GATER/Flash execution via Orca; then prioritize Confidential Intents capability verification and independent KF-02 foundation.

| Task | State | Evidence / limit |
|---|---|---|
| KF-00 | BLOCKED_EXTERNAL | Public bootstrap910d7b2; first actual Orca launch failed before task execution; runtime repaired, CLI GATER credential source pending; C00 NOT_RUN |
| KF-01 | BLOCKED_EXTERNAL | Initial official-doc review and no-auth HTTP probes recorded; authenticated S01-S08 NOT_RUN |
| KF-02 | TODO | Architecture/logical schema/design contracts selected; source scaffolding waits for required executor proof |
| KF-03..KF-11 | TODO | No implementation acceptance |

Codex owns docs, schema/interface decisions, review and integration. No active implementation worker. Attempt01 failed at readiness and its terminal was released with confirmed closure; local dispatch/run/task recovery IDs are in ignored `.deploy-local/orca-runtime.md`. Sanitized evidence: [executor attempt01](evidence/KF-00/executor-attempt-01.md), [bootstrap review](evidence/KF-00/bootstrap-review.md), [source capability report](evidence/KF-01/initial-capability-report.md). No funds/deployments/third-party messages performed.

## Runtime inventory

Verified locally: Node24.18.0; pnpm10.21.0; rustc1.99.0; cargo1.99.0; GitHub CLI authenticated as EndPx. DeepSeek Harness0.2.1-rc.5 is installed. Desktop configuration and user screenshot identify `gater/deepseek-v4.1-flash-1017-v2`, endpoint host api.gater.ai.id, credential environment name GATER_API_KEY. CLI dsh-tui originally selected the official provider; its two relevant model/provider patch entries have now been aligned to the existing desktop configuration, preserving an ignored local backup. Composed CLI routing verified, authenticated generation still NOT_RUN. No credentials displayed or committed.

A dsh-tui help boot reported missing @deepseek-ai/dsh-hooks-claude-code. Initial installer attempt with its stale latest-tag0.0.1-rc.5 was rejected. Registry version discovery then found the matching0.2.1-rc.5, which installed successfully. Actual Orca launch proved its older TUI0.17.0 profile plugin incompatible; launcher and profile upgraded to0.18.0 with supported compatibility declarations. No risk exemption or Harness downgrade applied. Profile composition now includes TUI and hooks; runtime task execution still unproven. Multiple Orca workspace records share this checkout; inspected and used an exact selector.

GATER_API_KEY is absent in the coordinator Process/User/Machine environments. The desktop provider references that environment name, but a successful desktop UI session does not prove CLI credential inheritance. A text-only clarification asks for the existing local credential location, never its value. Do not launch repeated workers before resolving this known prerequisite. Preserve the original failed Task and use its recorded recovery chain for a retry.

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
2. Resolve local CLI credential inheritance, then retry the same KF-00 task on actual GATER/DeepSeek Flash, review result independently, and retain dispatch evidence.
3. Produce KF-01 field-by-field capability report plus safe no-auth reachability evidence; request only missing authorized access.
4. Delegate minimal runnable KF-02 after C00, with frozen interface/schema and one migration writer.

Target:14 November2026 23:59 WIB internal. Date is not a live-readiness guarantee. Next decision checkpoint: executor proof and source capability result; escalate source-history gate promptly rather than inventing app-only coverage.
