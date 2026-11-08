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
      // Reuses the tested domain rule: canonical signed delta, known shape.
      const checked = validateMovement({
        assetId: movement.assetId,
        movementIndex: movement.movementIndex,
        kind: movement.kind,
        signedDelta: movement.signedDelta,
      });
      if (!checked.ok) {
        throw new Error(`event ${event.sourceEventId} movement ${movement.movementIndex}: ${checked.reason}`);
      }
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
            occurred_at, source_execution_at, observed_at, provenance, normalization_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      for (const movement of event.movements) {
        // Domain validation already guaranteed the canonical signed delta;
        // the DB domain enforces it again at the storage boundary.
        await tx.query(
          `INSERT INTO asset_movements (event_id, movement_index, network, asset_id, signed_delta, classification)
           VALUES ($1, $2, $3, $4, $5, $6)`,
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
