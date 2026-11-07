// KF-03 persistence integration tests (L02/L06) on a real PostgreSQL engine
// (PGlite). Scope: PASS_LOCAL — synthetic events only, no provider adapter,
// no live reconciliation (KF-01 stays BLOCKED_EXTERNAL).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  applyIngestBatch,
  countIngested,
  CursorConflictError,
  readCursor,
  type IngestBatch,
  type IngestEvent,
} from '../src/ingestion.js';

const migrationDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'api', 'migrations');
let db: PGlite;

before(async () => {
  db = new PGlite();
  for (const file of ['0001_initial.sql', '0002_cursor_version.sql']) {
    const sql = readFileSync(join(migrationDir, file), 'utf8');
    await db.exec(`BEGIN;\n${sql}\nCOMMIT;`);
  }
});

after(async () => {
  await db.close();
});

// ---- fixtures --------------------------------------------------------------

const PROVIDER = 'confidential-intents';
const NETWORK = 'testnet' as const;
const BINDING_A = '11111111-1111-4111-8111-111111111111';
const BINDING_B = '22222222-2222-4222-8222-222222222222';

let bindingSeq = 0;

async function seedBinding(bindingId: string): Promise<void> {
  bindingSeq += 1;
  await db.query(
    `INSERT INTO source_bindings (id, provider, network, source_identity_hash, source_account_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id, network) DO NOTHING`,
    [bindingId, PROVIDER, NETWORK, `hash-${bindingSeq}`, `trader-${bindingSeq}.testnet`],
  );
}

function ev(partial: {
  sourceEventId: string;
  revision?: number;
  status?: IngestEvent['status'];
  type?: IngestEvent['type'];
  provenance?: string | null;
  movements?: IngestEvent['movements'];
  occurredAtMs?: number;
}): IngestEvent {
  return {
    sourceEventId: partial.sourceEventId,
    revision: partial.revision ?? 1,
    type: partial.type ?? 'SWAP',
    status: partial.status ?? 'CONFIRMED',
    occurredAtMs: partial.occurredAtMs ?? 1_700_000_000_000,
    sourceExecutionAtMs: (partial.occurredAtMs ?? 1_700_000_000_000) + 1_000,
    observedAtMs: (partial.occurredAtMs ?? 1_700_000_000_000) + 2_000,
    provenance: partial.provenance ?? null,
    movements: partial.movements ?? [
      { assetId: 'testnet:near', movementIndex: 0, kind: 'TRADE_LEG', signedDelta: '-1000000000000000000000000' },
      { assetId: 'testnet:usdc', movementIndex: 1, kind: 'TRADE_LEG', signedDelta: '25000000' },
    ],
  };
}

function batch(bindingId: string, cursor: string, expectedVersion: number, events: IngestEvent[]): IngestBatch {
  return { provider: PROVIDER, bindingId, network: NETWORK, stream: 'activity', cursor, expectedVersion, events };
}

// 1. Crash/failure after fetch, before COMMIT: nothing may persist.
test('L02a: failure before COMMIT leaves no partial event, movement or cursor advance', async () => {
  await seedBinding(BINDING_A);
  const events = [ev({ sourceEventId: 'crash-1' }), ev({ sourceEventId: 'crash-2' })];
  await assert.rejects(
    applyIngestBatch(db, batch(BINDING_A, 'c1', 0, events), {
      beforeCommit: async () => {
        throw new Error('simulated crash after writes, before COMMIT');
      },
    }),
    /simulated crash/,
  );
  const counts = await countIngested(db, BINDING_A, NETWORK);
  assert.deepEqual(counts, { events: 0, movements: 0 }, 'rollback removed every write');
  const cursor = await readCursor(db, BINDING_A, NETWORK, 'activity');
  assert.equal(cursor.cursor, '', 'cursor not advanced');
  assert.equal(cursor.version, 0, 'cursor version untouched');
});

// 2. Commit succeeded, acknowledgment lost, then retry: no duplication and a
//    clean idempotent outcome after re-reading the cursor.
test('L02b: commit then lost ack -> stale retry conflicts safely, fresh retry is an idempotent no-op', async () => {
  await seedBinding(BINDING_B);
  const events = [ev({ sourceEventId: 'ack-1' })];
  const first = await applyIngestBatch(db, batch(BINDING_B, 'c1', 0, events));
  assert.deepEqual(first, { applied: true, eventsInserted: 1, cursorVersion: 1 });

  // Stale retry (worker still believes version 0) with the SAME cursor
  // target: recognized as already-applied, duplicating nothing. Conflicts
  // are for DIFFERENT cursor targets on stale versions (see the L06 test).
  const stale = await applyIngestBatch(db, batch(BINDING_B, 'c1', 0, events));
  assert.deepEqual(stale, { applied: false, alreadyApplied: true, cursorVersion: 1 });
  let counts = await countIngested(db, BINDING_B, NETWORK);
  assert.deepEqual(counts, { events: 1, movements: 2 }, 'stale retry duplicated nothing');

  // Fresh retry after re-reading the cursor: same target cursor -> no-op.
  const cursor = await readCursor(db, BINDING_B, NETWORK, 'activity');
  assert.equal(cursor.cursor, 'c1');
  const retry = await applyIngestBatch(db, batch(BINDING_B, 'c1', cursor.version, events));
  assert.deepEqual(retry, { applied: false, alreadyApplied: true, cursorVersion: 1 });
  counts = await countIngested(db, BINDING_B, NETWORK);
  assert.deepEqual(counts, { events: 1, movements: 2 }, 'retry duplicated nothing');

  // The next batch continues from the new version and new cursor.
  const second = await applyIngestBatch(
    db,
    batch(BINDING_B, 'c2', 1, [ev({ sourceEventId: 'ack-2', occurredAtMs: 1_700_000_100_000 })]),
  );
  assert.deepEqual(second, { applied: true, eventsInserted: 1, cursorVersion: 2 });
  assert.equal((await readCursor(db, BINDING_B, NETWORK, 'activity')).cursor, 'c2');
});

// 3. Duplicate delivery: same revision inside one batch and across batches.
test('L03/L01: duplicate delivery never doubles events or movements', async () => {
  const binding = '33333333-3333-4333-8333-333333333333';
  await seedBinding(binding);
  const events = [ev({ sourceEventId: 'dup-1' })];
  // Same event twice in ONE batch.
  const r1 = await applyIngestBatch(db, batch(binding, 'c1', 0, [...events, events[0]]));
  assert.equal(r1.applied && r1.eventsInserted, 1, 'in-batch duplicate stored once');
  assert.deepEqual(await countIngested(db, binding, NETWORK), { events: 1, movements: 2 });
  // Same event in a SECOND batch (different cursor target).
  const r2 = await applyIngestBatch(db, batch(binding, 'c2', 1, events));
  assert.equal(r2.applied && r2.eventsInserted, 0, 'cross-batch duplicate inserted nothing');
  assert.deepEqual(await countIngested(db, binding, NETWORK), { events: 1, movements: 2 });
  // A higher REVISION is a NEW event (identity includes revision).
  await applyIngestBatch(db, batch(binding, 'c3', 2, [ev({ sourceEventId: 'dup-1', revision: 2 })]));
  assert.deepEqual(await countIngested(db, binding, NETWORK), { events: 2, movements: 4 });
});

// 4. L06: two processors on the same binding/stream cannot advance the
//    cursor inconsistently; the loser's writes must not leak.
test('L06: conflicting cursor update rejects the stale processor without partial writes', async () => {
  const binding = '44444444-4444-4444-8444-444444444444';
  await seedBinding(binding);
  // Both processors read version 0 concurrently, then race to commit.
  const processorA = applyIngestBatch(db, batch(binding, 'cA', 0, [ev({ sourceEventId: 'pA-1' })]));
  const processorB = applyIngestBatch(db, batch(binding, 'cB', 0, [ev({ sourceEventId: 'pB-1' })]));
  const results = await Promise.allSettled([processorA, processorB]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.equal(fulfilled.length, 1, 'exactly one processor wins the CAS');
  assert.equal(rejected.length, 1, 'the other processor conflicts');
  const conflict = (rejected[0] as PromiseRejectedResult).reason;
  assert.ok(conflict instanceof CursorConflictError, `expected CursorConflictError, got ${String(conflict)}`);

  // The loser's event must NOT have leaked into storage.
  const counts = await countIngested(db, binding, NETWORK);
  assert.deepEqual(counts, { events: 1, movements: 2 }, 'only the winner wrote');

  // The loser re-reads the cursor and applies its own batch cleanly.
  const cursor = await readCursor(db, binding, NETWORK, 'activity');
  const retry = await applyIngestBatch(db, batch(binding, `${cursor.cursor}->cB`, cursor.version, [ev({ sourceEventId: 'pB-1' })]));
  assert.ok(retry.applied && retry.eventsInserted === 1);
  assert.deepEqual(await countIngested(db, binding, NETWORK), { events: 2, movements: 4 });
});

// Binding/network/provider enforcement through the storage boundary.
test('binding boundaries: wrong-network event FK + asset ids must carry the batch network', async () => {
  const binding = '55555555-5555-4555-8555-555555555555';
  await seedBinding(binding);
  // Event claims mainnet while the binding is testnet -> FK violation.
  const wrongNetwork: IngestBatch = {
    ...batch(binding, 'c1', 0, [ev({ sourceEventId: 'net-1' })]),
    network: 'mainnet',
  };
  await assert.rejects(applyIngestBatch(db, wrongNetwork), (err: unknown) => {
    // Either the asset-prefix binding check or the FK rejects; both are
    // correct (the asset-prefix check simply fires first).
    const msg = String((err as Error).message ?? err);
    const code = (err as { code?: string }).code;
    return msg.includes('not bound to network') || code === '23503';
  });
  assert.deepEqual(await countIngested(db, binding, NETWORK), { events: 0, movements: 0 });

  // Asset ids must be bound to the batch network (baseline 01 section 13).
  const crossNetworkAsset = ev({
    sourceEventId: 'net-2',
    movements: [{ assetId: 'mainnet:near', movementIndex: 0, kind: 'TRADE_LEG', signedDelta: '5' }],
  });
  await assert.rejects(
    applyIngestBatch(db, batch(binding, 'c1', 0, [crossNetworkAsset])),
    /asset mainnet:near is not bound to network testnet/,
  );
  assert.deepEqual(await countIngested(db, binding, NETWORK), { events: 0, movements: 0 }, 'still atomic');
});

// Money stays canonical integer strings at the storage boundary.
test('money: non-canonical deltas are rejected before storage (domain rule reuse)', async () => {
  const binding = '66666666-6666-4666-8666-666666666666';
  await seedBinding(binding);
  const bad = ev({
    sourceEventId: 'money-1',
    movements: [{ assetId: 'testnet:near', movementIndex: 0, kind: 'TRADE_LEG', signedDelta: '1.5' }],
  });
  await assert.rejects(
    applyIngestBatch(db, batch(binding, 'c1', 0, [bad])),
    /canonical signed/,
  );
  assert.deepEqual(await countIngested(db, binding, NETWORK), { events: 0, movements: 0 });
});

// Account-following: activity from outside Keyfolio is a first-class input.
test('outside-Keyfolio activity is ingested with provenance preserved', async () => {
  const binding = '77777777-7777-4777-8777-777777777777';
  await seedBinding(binding);
  const outside = ev({
    sourceEventId: 'ext-sdk-1',
    type: 'DEPOSIT',
    provenance: 'external-interface:direct-sdk',
    movements: [{ assetId: 'testnet:near', movementIndex: 0, kind: 'EXTERNAL_DEPOSIT', signedDelta: '5000000000000000000000000' }],
  });
  const r = await applyIngestBatch(db, batch(binding, 'c1', 0, [outside]));
  assert.ok(r.applied && r.eventsInserted === 1);
  const rows = await db.query(
    `SELECT provenance, normalization_version FROM ledger_events
     WHERE binding_id = $1 AND network = $2 AND source_event_id = 'ext-sdk-1'`,
    [binding, NETWORK],
  );
  const row = rows.rows[0] as { provenance: string; normalization_version: string };
  assert.equal(row.provenance, 'external-interface:direct-sdk');
  assert.equal(row.normalization_version, 'kf-ledger-v1', 'domain normalization version reused');
});

// Pending events store without movements; confirmed ones post them.
test('only CONFIRMED events post asset movements (database.md)', async () => {
  const binding = '88888888-8888-4888-8888-888888888888';
  await seedBinding(binding);
  await applyIngestBatch(db, batch(binding, 'c1', 0, [
    ev({ sourceEventId: 'pending-1', status: 'PENDING' }),
    ev({ sourceEventId: 'confirmed-1' }),
  ]));
  const counts = await countIngested(db, binding, NETWORK);
  assert.deepEqual(counts, { events: 2, movements: 2 }, 'pending event stored without movements');
});
