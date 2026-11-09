# KF-03 local reconciliation implementation evidence

Date: 2026-11-10. Scope: local PGlite fixture only. KF-01 provider access remains BLOCKED_EXTERNAL; no provider probe, wallet signing, deployment or live account reconciliation was performed.

## Implemented

- `applyIngestBatch` now keeps the event and cursor transaction atomic while quarantining invalid or unknown movement kinds. Quarantine rows carry the event, movement index/reason and `kf-ledger-v1`; no quarantined movement is inserted into `asset_movements`.
- Corrections persist a storage-safe form of the domain event key, reverse the target's confirmed movement once with `CORRECTION_REVERSAL`, then post the corrected movement. Missing targets quarantine with an explicit reconciliation reason.
- `0003_kf03_reconciliation.sql` adds quarantine, opening/closing balance snapshots and items, reconciliation runs, and source health observations. Access, freshness, coverage, schema, reconciliation and last-trade fields are independent; a readable idle account can remain healthy.
- `recordBalanceReconciliation` uses `packages/domain`'s exact bigint `reconcileBalances` rule and writes both snapshots, exact mismatch JSON and a health observation in one transaction.
- Event provenance, source execution time and local observation time remain separate. External-interface activity remains a normal first-class event input.

## Focused proof

`node --import tsx --test --test-force-exit apps/worker/test/ingestion-db.test.ts` — **12/12 PASS_LOCAL**.

The fixture covers crash-before-commit rollback, lost-ack retry, duplicate replay, cursor conflict/no partial loser write, canonical amount quarantine, unknown movement quarantine, correction reversal/idempotency, exact balanced and mismatched snapshots, idle readable health, negative-balance rejection with no partial snapshot, outside-Keyfolio provenance/time, and confirmed-only movement posting.

## Classification

- `PASS_LOCAL`: implementation and PGlite evidence above.
- `NOT_RUN`: permitted live account reconciliation and provider-backed coverage.
- `BLOCKED_EXTERNAL`: KF-01 access/permission and coverage gates remain unresolved.
