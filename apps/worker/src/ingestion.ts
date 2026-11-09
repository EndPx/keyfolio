// KF-03 persistence (minimal ingestion store, PASS_LOCAL scope): events,
// asset movements and the stream cursor are written in ONE transaction with
// version-based cursor ownership (CAS), so replay is harmless, failures
// leave no partial data, and concurrent processors cannot advance a cursor
// inconsistently (L02/L06).
//
// Accounting semantics come from the ALREADY TESTED domain rules
// (@keyfolio/domain): movement deltas are validated with validateMovement
// and events carry NORMALIZATION_VERSION - no second accounting algorithm
// lives here. Only CONFIRMED events post asset movements (database.md).
// Synthetic events from outside Keyfolio are first-class inputs
// (account-following): provenance travels with the event row.

import {
  LEDGER_EVENT_STATUSES,
  LEDGER_EVENT_TYPES,
  NORMALIZATION_VERSION,
  validateMovement,
  type LedgerEventStatus,
  type LedgerEventType,
  reconcileBalances,
  type AssetBalance,
} from '@keyfolio/domain';
import type { ParsedValue } from './json.js';

/**
 * Minimal DB seam: PGlite (tests) and node-postgres (worker) both satisfy
 * this structurally. Rows are typed loosely here and narrowed at the call
 * sites, because the two drivers type their results differently.
 */
export type IngestDb = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  transaction: <T>(fn: (tx: IngestDb) => Promise<T>) => Promise<T>;
};

export interface IngestMovement {
  assetId: string;
  movementIndex: number;
  kind: string;
  /** Canonical signed atomic string (^(0|-?[1-9][0-9]*)$). */
  signedDelta: string;
}

export interface IngestEvent {
  sourceEventId: string;
  revision: number;
  type: LedgerEventType;
  status: LedgerEventStatus;
  occurredAtMs: number;
  sourceExecutionAtMs: number | null;
  observedAtMs: number;
  /** Free-form provenance; outside-Keyfolio activity uses e.g. "external-interface:direct-sdk". */
  provenance: string | null;
  /** For CORRECTION, stable target key: provider\0account\0event\0revision. */
  supersedesEventKey?: string | null;
  movements: IngestMovement[];
}

export interface IngestBatch {
  provider: string;
  bindingId: string;
  network: 'mainnet' | 'testnet';
  stream: string;
  /** New cursor value after this batch. */
  cursor: string;
  /** CAS: the cursor version this batch was built against. */
  expectedVersion: number;
  events: IngestEvent[];
}

export interface IngestOptions {
  /** Test/ops seam: runs just before COMMIT; throwing rolls everything back. */
  beforeCommit?: () => Promise<void>;
}

export type IngestResult =
  | { applied: true; eventsInserted: number; cursorVersion: number }
  | { applied: false; alreadyApplied: true; cursorVersion: number };

export class CursorConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CursorConflictError';
  }
}

function msToTs(ms: number): string {
  return new Date(ms).toISOString();
}

function isoOrNull(ms: number | null): string | null {
  return ms === null ? null : msToTs(ms);
}

// PostgreSQL text (and PGlite) cannot carry NUL bytes, while the pure domain
// eventKey deliberately uses NUL separators. Persist a reversible fixture-safe
// representation at this storage seam.
function storageEventKey(key: string): string {
  return key.replaceAll('\u0000', '|');
}

/** Validate every event up front (fail-closed before any DB work). */
function validateBatch(batch: IngestBatch): void {
  if (typeof batch.provider !== 'string' || batch.provider.length === 0) {
    throw new Error('provider must be a nonempty string');
  }
  if (typeof batch.bindingId !== 'string' || batch.bindingId.length === 0) {
    throw new Error('bindingId must be a nonempty string');
  }
  if (batch.network !== 'mainnet' && batch.network !== 'testnet') {
    throw new Error('network must be mainnet or testnet');
  }
  if (typeof batch.stream !== 'string' || batch.stream.length === 0) {
    throw new Error('stream must be a nonempty string');
  }
  if (typeof batch.cursor !== 'string' || batch.cursor.length === 0) {
    throw new Error('cursor must be a nonempty string');
  }
  if (!Number.isSafeInteger(batch.expectedVersion) || batch.expectedVersion < 0) {
    throw new Error('expectedVersion must be a safe integer >= 0');
  }
  for (const event of batch.events) {
    if (typeof event.sourceEventId !== 'string' || event.sourceEventId.length === 0) {
      throw new Error('sourceEventId must be a nonempty string');
    }
    if (!Number.isSafeInteger(event.revision) || event.revision < 1) {
      throw new Error(`event ${event.sourceEventId}: revision must be >= 1`);
    }
    if (!LEDGER_EVENT_TYPES.includes(event.type)) {
      throw new Error(`event ${event.sourceEventId}: unknown type ${String(event.type)}`);
    }
    if (!LEDGER_EVENT_STATUSES.includes(event.status)) {
      throw new Error(`event ${event.sourceEventId}: unknown status ${String(event.status)}`);
    }
    if (!Number.isSafeInteger(event.occurredAtMs) || event.occurredAtMs < 0) {
      throw new Error(`event ${event.sourceEventId}: occurredAtMs must be a nonnegative safe integer`);
    }
    if (event.sourceExecutionAtMs !== null && (!Number.isSafeInteger(event.sourceExecutionAtMs) || event.sourceExecutionAtMs < 0)) {
      throw new Error(`event ${event.sourceEventId}: sourceExecutionAtMs must be null or a nonnegative safe integer`);
    }
    for (const movement of event.movements) {
      // Network binding (baseline 01 section 13: network belongs in all asset
      // identities): the asset id must carry this batch's network prefix.
      if (!movement.assetId.startsWith(`${batch.network}:`)) {
        throw new Error(
          `event ${event.sourceEventId} movement ${movement.movementIndex}: asset ${movement.assetId} is not bound to network ${batch.network}`,
        );
      }
      // Reuses the tested domain rule. Unknown/invalid movements are retained
      // as event evidence and quarantined transactionally; network identity is
      // still a hard batch failure because it would cross account boundaries.
      const checked = validateMovement({
        assetId: movement.assetId,
        movementIndex: movement.movementIndex,
        kind: movement.kind,
        signedDelta: movement.signedDelta,
      });
      if (!checked.ok) continue;
    }
  }
}

/**
 * Apply one ingestion batch atomically:
 *   BEGIN -> lock the cursor row (FOR UPDATE) -> CAS the version ->
 *   insert events (dedupe by the unique key) -> insert movements for
 *   newly-inserted CONFIRMED events -> advance the cursor -> COMMIT.
 * Duplicate deliveries become no-ops; any failure rolls back everything.
 */
export async function applyIngestBatch(
  db: IngestDb,
  batch: IngestBatch,
  options?: IngestOptions,
): Promise<IngestResult> {
  validateBatch(batch);
  return db.transaction(async (tx) => {
    // Ensure the cursor row exists, then lock it: this serializes the two
    // concurrent processors on the same binding/stream (L06).
    await tx.query(
      `INSERT INTO worker_cursors (binding_id, network, stream, cursor, version)
       VALUES ($1, $2, $3, '', 0)
       ON CONFLICT (binding_id, stream) DO NOTHING`,
      [batch.bindingId, batch.network, batch.stream],
    );
    const current = await tx.query(
      `SELECT cursor, version FROM worker_cursors
       WHERE binding_id = $1 AND network = $2 AND stream = $3
       FOR UPDATE`,
      [batch.bindingId, batch.network, batch.stream],
    );
    const row = current.rows[0] as { cursor: string; version: string | number } | undefined;
    if (!row) throw new Error('cursor row missing after upsert');
    const version = typeof row.version === 'number' ? row.version : parseInt(row.version, 10);

    // Idempotent retry after a lost acknowledgment: the batch already committed.
    if (row.cursor === batch.cursor) {
      return { applied: false, alreadyApplied: true, cursorVersion: version };
    }
    // CAS: a concurrent processor advanced the cursor; this batch is stale
    // and must not be partially applied.
    if (version !== batch.expectedVersion) {
      throw new CursorConflictError(
        `cursor version conflict on ${batch.bindingId}/${batch.stream}: expected ${batch.expectedVersion}, current ${version}`,
      );
    }

    let eventsInserted = 0;
    for (const event of batch.events) {
      const inserted = await tx.query(
        `INSERT INTO ledger_events
           (provider, network, binding_id, source_event_id, revision, type, status,
            occurred_at, source_execution_at, observed_at, provenance, supersedes_event_key, normalization_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (provider, network, binding_id, source_event_id, revision) DO NOTHING
         RETURNING id`,
        [
          batch.provider,
          batch.network,
          batch.bindingId,
          event.sourceEventId,
          event.revision,
          event.type,
          event.status,
          msToTs(event.occurredAtMs),
          isoOrNull(event.sourceExecutionAtMs),
          msToTs(event.observedAtMs),
          event.provenance,
          event.supersedesEventKey === undefined || event.supersedesEventKey === null ? null : storageEventKey(event.supersedesEventKey),
          NORMALIZATION_VERSION,
        ],
      );
      const eventId = (inserted.rows[0] as { id?: string } | undefined)?.id;
      if (eventId === undefined || eventId === null) {
        continue; // exact duplicate of an already-stored revision: no effects
      }
      eventsInserted += 1;
      if (event.status !== 'CONFIRMED') {
        continue; // only confirmed economic effects post movements (database.md)
      }
      const validated = event.movements.map((movement) => validateMovement({
        assetId: movement.assetId,
        movementIndex: movement.movementIndex,
        kind: movement.kind,
        signedDelta: movement.signedDelta,
      }));
      const invalid = validated.find((movement) => !movement.ok);
      const unknown = validated.find((movement) => movement.ok && !movement.knownKind);
      if (invalid || unknown) {
        await tx.query(
          `INSERT INTO ledger_quarantines (event_id, movement_index, reason, normalization_version)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (event_id, movement_index, reason) DO NOTHING`,
          [eventId, invalid ? event.movements[validated.indexOf(invalid)]?.movementIndex ?? null : event.movements[validated.indexOf(unknown!)]?.movementIndex ?? null,
            invalid ? invalid.reason : `unknown movement kind ${String((unknown as { kind: string }).kind)}`, NORMALIZATION_VERSION],
        );
        continue;
      }
      // Corrections reverse the target's posted movement exactly once, then
      // post corrected movements. Reversal rows remain auditable and are
      // classified separately from the source event's own movements.
      if (event.type === 'CORRECTION' && event.supersedesEventKey) {
        const target = await tx.query(
          `SELECT e.id, m.movement_index, m.network, m.asset_id, m.signed_delta, m.classification
           FROM ledger_events e JOIN asset_movements m ON m.event_id = e.id
           WHERE e.binding_id = $1 AND e.network = $2
             AND e.provider = $3 AND e.supersedes_event_key IS NULL
             AND (e.provider || '|' || e.binding_id::text || '|' || e.source_event_id || '|' || e.revision::text) = $4`,
          [batch.bindingId, batch.network, batch.provider, storageEventKey(event.supersedesEventKey)],
        );
        if (target.rows.length === 0) {
          await tx.query(
            `INSERT INTO ledger_quarantines (event_id, movement_index, reason, normalization_version)
             VALUES ($1, NULL, $2, $3)
             ON CONFLICT (event_id, movement_index, reason) DO NOTHING`,
            [eventId, `correction target ${event.supersedesEventKey} not found: reconciliation required`, NORMALIZATION_VERSION],
          );
          continue;
        }
        for (const row of target.rows as Array<{ movement_index: number; network: string; asset_id: string; signed_delta: string; classification: string }>) {
          await tx.query(
            `INSERT INTO asset_movements (event_id, movement_index, network, asset_id, signed_delta, classification)
             VALUES ($1, $2, $3, $4, $5, 'CORRECTION_REVERSAL')`,
            [eventId, 1000000 + row.movement_index, row.network, row.asset_id, row.signed_delta.startsWith('-') ? row.signed_delta.slice(1) : `-${row.signed_delta}`],
          );
        }
      }
      for (const movement of event.movements) {
        // Domain validation already guaranteed the canonical signed delta;
        // the DB domain enforces it again at the storage boundary.
        await tx.query(
          `INSERT INTO asset_movements (event_id, movement_index, network, asset_id, signed_delta, classification)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (event_id, movement_index) DO NOTHING`,
          [eventId, movement.movementIndex, batch.network, movement.assetId, movement.signedDelta, movement.kind],
        );
      }
    }

    const advanced = await tx.query(
      `UPDATE worker_cursors
       SET cursor = $4, version = version + 1, lease_owner = 'ingest', updated_at = now()
       WHERE binding_id = $1 AND network = $2 AND stream = $3 AND version = $5
       RETURNING version`,
      [batch.bindingId, batch.network, batch.stream, batch.cursor, batch.expectedVersion],
    );
    if (advanced.rows.length !== 1) {
      throw new CursorConflictError('cursor CAS update matched no rows');
    }
    const newVersion = (advanced.rows[0] as { version: string | number }).version;
    if (options?.beforeCommit) {
      await options.beforeCommit();
    }
    return { applied: true, eventsInserted, cursorVersion: Number(newVersion) };
  });
}

/** Read the current cursor (value + version) for a binding/stream. */
export async function readCursor(
  db: IngestDb,
  bindingId: string,
  network: 'mainnet' | 'testnet',
  stream: string,
): Promise<{ cursor: string; version: number }> {
  const res = await db.query(
    `SELECT cursor, version FROM worker_cursors
     WHERE binding_id = $1 AND network = $2 AND stream = $3`,
    [bindingId, network, stream],
  );
  const row = res.rows[0] as { cursor: string; version: string | number } | undefined;
  if (!row) return { cursor: '', version: 0 };
  return {
    cursor: row.cursor,
    version: typeof row.version === 'number' ? row.version : parseInt(row.version, 10),
  };
}

/** Count stored events and movements for a binding (test/reconciliation). */
export async function countIngested(
  db: IngestDb,
  bindingId: string,
  network: 'mainnet' | 'testnet',
): Promise<{ events: number; movements: number }> {
  const events = await db.query(
    `SELECT count(*)::int AS n FROM ledger_events WHERE binding_id = $1 AND network = $2`,
    [bindingId, network],
  );
  const movements = await db.query(
    `SELECT count(*)::int AS n FROM asset_movements m
     JOIN ledger_events e ON e.id = m.event_id
     WHERE e.binding_id = $1 AND e.network = $2`,
    [bindingId, network],
  );
  return {
    events: Number((events.rows[0] as { n: number }).n),
    movements: Number((movements.rows[0] as { n: number }).n),
  };
}

export interface SnapshotInput {
  bindingId: string;
  network: 'mainnet' | 'testnet';
  snapshotAtMs: number;
  sourceExecutionAtMs: number | null;
  provenance: string;
  opening: readonly AssetBalance[];
  closing: readonly AssetBalance[];
  confirmedDeltas: readonly { assetId: string; delta: bigint }[];
  observedAtMs: number;
  accessState: 'READABLE' | 'UNAUTHORIZED' | 'DISCONNECTED' | 'UNKNOWN';
  freshnessState: 'FRESH' | 'STALE' | 'UNKNOWN';
  coverageState: 'COMPLETE' | 'PARTIAL' | 'UNKNOWN';
  schemaState: 'VALID' | 'INVALID' | 'UNKNOWN';
  lastTradeAtMs: number | null;
}

export type SnapshotResult = {
  reconciliation: 'BALANCED' | 'MISMATCH' | 'INCOMPLETE';
  coverageState: SnapshotInput['coverageState'];
  reconciliationId: string;
};

/** Persist aligned opening/closing snapshots, exact reconciliation and the
 * independent access/freshness/coverage/last-trade health dimensions in one
 * transaction. This is fixture-safe and does not imply provider access. */
export async function recordBalanceReconciliation(db: IngestDb, input: SnapshotInput): Promise<SnapshotResult> {
  const verdict = reconcileBalances(input);
  const reconciliation = !verdict.complete ? 'INCOMPLETE' : verdict.balanced ? 'BALANCED' : 'MISMATCH';
  const mismatches = verdict.complete && !verdict.balanced ? verdict.mismatches : [];
  return db.transaction(async (tx) => {
    const insertSnapshot = async (boundary: 'opening' | 'closing', balances: readonly AssetBalance[]): Promise<string> => {
      const row = await tx.query(
        `INSERT INTO balance_snapshots (binding_id, network, boundary, snapshot_at, source_execution_at, provenance)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [input.bindingId, input.network, boundary, msToTs(input.snapshotAtMs), isoOrNull(input.sourceExecutionAtMs), input.provenance],
      );
      const id = String((row.rows[0] as { id: string }).id);
      for (const balance of balances) {
        await tx.query(
          `INSERT INTO balance_snapshot_items (snapshot_id, network, asset_id, amount_atomic)
           VALUES ($1, $2, $3, $4)`,
          [id, input.network, balance.assetId, balance.balanceAtomic],
        );
      }
      return id;
    };
    const openingId = await insertSnapshot('opening', input.opening);
    const closingId = await insertSnapshot('closing', input.closing);
    const run = await tx.query(
      `INSERT INTO reconciliation_runs
       (binding_id, network, opening_snapshot_id, closing_snapshot_id, result, coverage_state, mismatches, normalization_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) RETURNING id`,
      [input.bindingId, input.network, openingId, closingId, reconciliation, input.coverageState, JSON.stringify(mismatches), NORMALIZATION_VERSION],
    );
    const health = reconciliation === 'BALANCED' ? 'BALANCED' : reconciliation === 'MISMATCH' ? 'MISMATCH' : 'UNKNOWN';
    await tx.query(
      `INSERT INTO source_health_observations
       (binding_id, network, observed_at, access_state, freshness_state, coverage_state, schema_state, reconciliation_state, last_trade_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [input.bindingId, input.network, msToTs(input.observedAtMs), input.accessState, input.freshnessState, input.coverageState, input.schemaState, health, isoOrNull(input.lastTradeAtMs)],
    );
    return { reconciliation, coverageState: input.coverageState, reconciliationId: String((run.rows[0] as { id: string }).id) };
  });
}
