# KF-03 evidence — ingestion persistence (L02/L06 subset, PASS_LOCAL)

Date: 2026-11-08. Scope: minimal ingestion storage over PostgreSQL (PGlite as the local test engine): events + asset movements + stream cursor in ONE transaction with version-based cursor ownership. NO provider adapter, NO live reconciliation — KF-01 stays BLOCKED_EXTERNAL; KF-02b dispatch scope untouched (no api-contract/provider-adapter edits).

Commit + branch: see git log; branch main.
Environment: Windows host; Node 24.18.0; PGlite 0.5.15 (PostgreSQL engine, same as accepted KF-02a evidence); migrations 0001_initial + 0002_cursor_version applied inside the test.
Commands: `pnpm test:run` (95/95 total; the new file `apps/worker/test/ingestion-db.test.ts` contributes 8 tests) — plus the standalone synthetic check `node --test scripts/testnet/` (5/5, M1).
Classification: PASS_LOCAL.

## What the tests prove (one file, 8 integration tests)

- **L02a** crash after fetch, before COMMIT: a seam throwing just before COMMIT rolls back EVERYTHING — zero events, zero movements, cursor value and version untouched.
- **L02b** commit then lost acknowledgment: a stale retry with the SAME cursor target is recognized as already-applied (idempotent no-op, zero duplication); a retry after re-reading the cursor is identical; the next batch continues from the advanced version.
- **Duplicate delivery**: the same (provider, binding, source_event_id, revision) inside one batch and across batches stores exactly one event and one movement set; a higher REVISION is a new event (identity includes revision).
- **L06 conflicting cursor update**: two processors racing with the same expected version — exactly one wins the CAS, the loser gets CursorConflictError and its writes do NOT leak; the loser then re-reads and applies its own batch cleanly.
- **Binding boundaries**: an event whose (binding, network, provider) tuple mismatches the binding row is rejected by the composite FK (23503); asset ids must carry the batch network prefix (`testnet:...`), enforced fail-closed before storage.
- **Money**: non-canonical deltas ("1.5") rejected before storage via the TESTED domain rule (`validateMovement` from @keyfolio/domain — no second accounting algorithm; normalization rows carry `kf-ledger-v1`).
- **Account-following**: synthetic activity from OUTSIDE Keyfolio (provenance `external-interface:direct-sdk`) ingested as a first-class event.
- **database.md rule**: only CONFIRMED events post asset movements; PENDING events store without effects.

## Design notes

- Cursor ownership: `worker_cursors.version` (migration 0002, reversible) + `SELECT ... FOR UPDATE` + compare-and-set `WHERE version = expected`; concurrent batches serialize on the row lock and the loser conflicts atomically. No Redis, no broker.
- Movements inherit the batch network structurally (no per-movement network field); asset-id prefix enforcement keeps asset identities network-bound.
- `beforeCommit` is a small test/ops seam for crash injection (L02a); production passes nothing.

## Honest limits — KF-03 is NOT complete or accepted

- Not yet integrated: the actual worker loop (provider adapter is KF-02b dispatch scope), balance_snapshots/reconciliation tables and runs, corrections/corrections-reversal storage flow, coverage labels, the full L01–L07 set beyond these cases, and any live account reconciliation.
- Engine evidence is PGlite (local WASM PostgreSQL), consistent with KF-02a; external PostgreSQL server behavior NOT_RUN.
- No independent Codex review yet; nothing here is ACCEPTED.
