# Codex coordinator / DeepSeek executor protocol

## Roles

Codex owns interpretation, architecture, dependency sequencing, stable API/data contracts, integration, code review, acceptance, and user communication. Codex MUST inspect worker diffs and financial/auth evidence before acceptance. It does not merely forward DeepSeek's success statement.

DeepSeek implements bounded assignments, writes meaningful tests, reports observed results and blockers, and requests decisions when the task conflicts with its environment. It cannot unilaterally change product coverage, authorize funds, mark release acceptance, or delegate to a different model.

Default: one DeepSeek implementation worker. Additional independent workers are allowed only if Codex proves disjoint file ownership and the actual runtime can support them; use Orca-managed isolation when edits conflict. No concurrent root lockfile/schema/migration writers. Codex integrates reviewed changes in dependency order.

## Runtime discovery

This packet does not assert that DeepSeek is installed or callable in Orca. Read installed `orca-cli` and `orchestration` skills, resolve executable once, then read version-matched guides using that executable. Current local guides inspected on 2026-11-06 supported `skills get orca-cli --json` and `skills get orchestration --json`; recheck in the receiving runtime.

Discover the installed DeepSeek agent/provider/model selector through supported CLI help/configuration. Do not assume `--agent deepseek`, `dsh`, or a particular model string exists. Do not treat ZCode desktop settings or a local version command as evidence of an Orca-launched DeepSeek task.

Before real work, pass KF-00 readiness: a bounded task delivered, actual executor identity recorded, returned result inspected, and task status reconciled. If configuration is missing, report the exact missing prerequisite; do independent Codex planning, not an undeclared executor substitution.

## Orca orchestration behavior

Use the installed version-matched recipe. The guide inspected here starts supervised workers with `orchestration worker-start`, receives asynchronous completion, and uses orchestration mail for follow-ups. Exact agent selector remains runtime-discovered. Load `references/coordinator-loop.md` before explicit DAG operations. If guide changes, current guide wins on CLI mechanics, not on product scope.

For supervised tasks, use dispatch mailbox IDs for steering. Do not type into a worker terminal behind orchestration tracking. Follow receipt `next` instructions. In the inspected guide, coordinator ends its turn after dispatch and Orca wakes it on progress/completion; do not run polling scripts that consume its mailbox. A temporary yield to Orca is not abandoning the project.

Workers with Task/Dispatch preambles obey the preamble's ask/worker_done lifecycle. A tool returning accepted proves prompt acceptance only, not successful implementation. Preserve dispatch IDs and runtime handles; do not resend ambiguous launches as fresh tasks. Load recovery guidance on failed/unknown launch outcomes.

## Dispatch template

```text
TASK: KF-xx / short title
ROLE: DeepSeek executor; Codex is coordinator and reviewer.
PROJECT: exact repository/worktree path and branch.
BASE: base commit plus relevant preserved dirty files.
READ: packet sections and specific existing files.
OBJECTIVE: one observable behavior.
INPUT CONTRACT: exact interfaces/types/state transitions already frozen.
ALLOWED EDITS: explicit directories/files; migration owner if any.
DO NOT EDIT: shared files owned by another task.
REQUIREMENTS: R-/D-/G- references from the spec, reproduced if needed.
ACCEPTANCE: test IDs and concrete expected values from file 02.
ENVIRONMENT: fixture/sandbox/testnet/live; authorized network and budget if any.
AUTHORITY: local code/tests only unless separately stated; no publishing or funds.
DEPENDENCIES: exact accepted tasks and unresolved external gates.
STOP/ASK: ask Codex if interfaces, coverage, money policy or authorization must change.
REPORT: diff/files, commands/exit codes, results, sanitized evidence, blockers, commit.
DONE: report implementation completion through the Orca protocol; Codex accepts it.
```

Do not send the worker only “build backend” or a full chat transcript. Every task must include enough context to work without guessing. Point to file 01 as the single behavior authority instead of copying inconsistent variants of the entire spec.

## Worker completion template

```text
Task:
Status: IMPLEMENTED / BLOCKED_EXTERNAL / FAILED
Base and result commit:
Files changed:
Behavior delivered:
Tests: command, exit status, test IDs, result classification
Evidence files:
Untested behavior:
External blockers:
Spec deviations: none, or exact approved decision ID
Next integration requirement:
```

Codex review: inspect diff and worktree status; verify tests are meaningful and match independent expected results; review authority boundaries; inspect final evidence for actual commit; run focused independent checks for financial/auth paths or evidence gaps; send fixes back to the worker; accept only after requirements pass. Do not rerun an entire expensive suite without a reason when existing evidence already covers the unchanged result.

## Decision levels

Codex resolves routine code choices, compatible package versions, test organization, performance optimizations, and bug fixes under the spec. Record significant choices in docs/decisions.md with problem, choice, evidence, alternatives, affected requirements.

User resolves product scope cuts, account-only-vs-app-only tradeoffs, new fund custody, external spending, paid services, customer-right changes, public deployment/publishing, and unavailable credentials/access. Ask a short concrete question only after preparing a reviewable option. Waiting for a dependency does not stop unrelated authorized work.

Unknown capability -> explicit probe. Failed probe -> recorded blocker. Never “assume supported” because a UI needs the feature. No fake PnL, generated transaction hashes, hardcoded ownership, always-true signature verifier, fixture fallback in live mode, or admin master key in public config.

## Persistent status and recovery

docs/status.md contains current commit, task states, dispatch references, active file ownership, accepted evidence links, blockers, next ready tasks, and date forecast. Update at task acceptance/blocker/material risk, not every log line.

After context loss or runtime restart: read status + git status + task evidence; reconcile actual Orca task state; do not restart finished work or launch duplicate workers. Never infer an idle/terminated worker solely from silence. Consult recovery guide before stopping or replacing an unknown worker.

## Coordinator checkpoints

1. Bootstrap and actual executor proof.
2. Confidential access gate with observed account scope.
3. Interface/data schema freeze.
4. Financial contract review before any deployment.
5. NFT access review including transfer rollback and stale RPC.
6. Full source-to-copy acceptance review.
7. Release truth report by the target date, regardless of whether result is complete or blocked.

User update format (Indonesian): completed and evidence; currently running; exact blocker/decision; next bounded outcome. State date risk when discovered. Do not repeatedly ask approval for ordinary local fixes already within scope.
