# KF-02a review01 — changes required

Date:2026-11-06. Reviewer:Codex. Worker reported IMPLEMENTED/PASS_LOCAL; acceptance withheld. No implementation source has been committed by Codex at this checkpoint.

## Checks actually run

`pnpm check`: exit0, build/typecheck passed,41/41 tests passed. This reproduces the worker suite; it does not establish missing boundary behavior.

Independent Node probes against compiled domain exports:

- `evaluateCopyEligibility({confirmed:true,sourceExecutionAtMs:NaN,nowMs:0})` returned `{eligible:true,reason:'eligible'}` — FAILED fail-closed timestamp handling.
- `isReadableIdleHealthy({lastUsableAt:100,now:0})` returned true — FAILED future observation handling.
- Source/test inspection shows freshness default24h, conflating observation freshness with the separate24h monitor termination threshold. Baseline source stale threshold is120s.

Independent PGlite migration/INSERT probe: created a testnet binding with provider fixture, then inserted a mainnet ledger event with provider other referencing that binding. INSERT succeeded. FAILED network/provider relationship isolation: UUID-only FK is insufficient.

Other review gaps: `db:migrate` silently chooses ephemeral engine without DATABASE_URL, including nonfixture environment; README lacks actual API/worker start/env-loading instructions and still says no modules exist; fractional INSERT tests lack a preserved existing sentinel and only some rejection tests assert specific constraint SQLSTATE; claimed down migration not exercised.

## Required revision

Fail closed on invalid time values, separate120s freshness from24h outage, preserve monotonic observation ordering, enforce composite context FKs, test exact constraint failures and unchanged data for fractional direct INSERTs, make local ephemeral migration explicit with no external fallback, exercise down/up, and document runnable setup accurately. Regression inputs and ownership delivered through the existing Orca dispatch mailbox. Executor implements; Codex reviews again before acceptance/commit/push.

The initial41-pass report is preserved as initial evidence, not accepted final truth. PGlite is local PostgreSQL-engine evidence only; no external-server/testnet/live access established. KF-01 remains BLOCKED_EXTERNAL.
