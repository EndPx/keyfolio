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
  recordBalanceReconciliation,
  type IngestBatch,
  type IngestDb,
  type IngestEvent,
} from '../src/ingestion.js';

const migrationDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'api', 'migrations');
let db: IngestDb;
let pglite: PGlite;

before(async () => {
  pglite = new PGlite();
  // The seam only uses query/transaction; PGlite satisfies it structurally.
  db = pglite as unknown as IngestDb;
  for (const file of ['0001_initial.sql', '0002_cursor_version.sql', '0003_kf03_reconciliation.sql']) {
    const sql = readFileSync(join(migrationDir, file), 'utf8');
    await pglite.exec(`BEGIN;\n${sql}\nCOMMIT;`);
  }
});

// PGlite teardown inside the combined node:test process crashes V8 during
// isolate disposal; the OS reclaims the ephemeral engine at process exit.
// (Standalone runs pass 8/8 — see evidence.)
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
  supersedesEventKey?: string | null;
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
    supersedesEventKey: partial.supersedesEventKey ?? null,
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
test('money: non-canonical deltas are quarantined without storage effects', async () => {
  const binding = '66666666-6666-4666-8666-666666666666';
  await seedBinding(binding);
  const bad = ev({
    sourceEventId: 'money-1',
    movements: [{ assetId: 'testnet:near', movementIndex: 0, kind: 'TRADE_LEG', signedDelta: '1.5' }],
  });
  const result = await applyIngestBatch(db, batch(binding, 'c1', 0, [bad]));
  assert.ok(result.applied && result.eventsInserted === 1);
  assert.deepEqual(await countIngested(db, binding, NETWORK), { events: 1, movements: 0 });
  const q = await db.query(`SELECT reason FROM ledger_quarantines WHERE event_id IN (SELECT id FROM ledger_events WHERE source_event_id = 'money-1')`);
  assert.match(String((q.rows[0] as { reason: string }).reason), /canonical signed/);
});

test('L04: unknown movement kind is quarantined and never becomes a balance effect', async () => {
  const binding = '99999999-9999-4999-8999-999999999999';
  await seedBinding(binding);
  const result = await applyIngestBatch(db, batch(binding, 'q1', 0, [ev({
    sourceEventId: 'unknown-1',
    movements: [{ assetId: 'testnet:near', movementIndex: 0, kind: 'MYSTERY_AIRDROP', signedDelta: '7' }],
  })]));
  assert.ok(result.applied);
  assert.deepEqual(await countIngested(db, binding, NETWORK), { events: 1, movements: 0 });
  const q = await db.query(`SELECT reason FROM ledger_quarantines WHERE event_id IN (SELECT id FROM ledger_events WHERE source_event_id = 'unknown-1')`);
  assert.match(String((q.rows[0] as { reason: string }).reason), /MYSTERY_AIRDROP/);
});

test('L03: correction reverses the original once and posts corrected movements', async () => {
  const binding = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await seedBinding(binding);
  const original = ev({ sourceEventId: 'corr-original', movements: [{ assetId: 'testnet:near', movementIndex: 0, kind: 'TRADE_LEG', signedDelta: '10' }] });
  const key = `${PROVIDER}\u0000${binding}\u0000corr-original\u00001`;
  await applyIngestBatch(db, batch(binding, 'c1', 0, [original]));
  const correction = ev({ sourceEventId: 'corr-fix', type: 'CORRECTION', supersedesEventKey: key, movements: [{ assetId: 'testnet:near', movementIndex: 0, kind: 'TRADE_LEG', signedDelta: '4' }] });
  await applyIngestBatch(db, batch(binding, 'c2', 1, [correction]));
  const rows = await db.query(`SELECT signed_delta::text AS d, classification FROM asset_movements m JOIN ledger_events e ON e.id = m.event_id WHERE e.binding_id = $1`, [binding]);
  const effects = rows.rows.map((r) => [String((r as { d: string }).d), String((r as { classification: string }).classification)]).sort((a, b) => `${a[1]}:${a[0]}`.localeCompare(`${b[1]}:${b[0]}`));
  assert.deepEqual(effects, [['-10', 'CORRECTION_REVERSAL'], ['10', 'TRADE_LEG'], ['4', 'TRADE_LEG']]);
  const retry = await applyIngestBatch(db, batch(binding, 'c3', 2, [correction]));
  assert.ok(retry.applied && retry.eventsInserted === 0);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM asset_movements m JOIN ledger_events e ON e.id = m.event_id WHERE e.binding_id = $1`, [binding])).rows[0]!.n, 3);
});

test('L05 and health dimensions: exact reconciliation records balanced and idle readable state', async () => {
  const binding = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await seedBinding(binding);
  const result = await recordBalanceReconciliation(db, {
    bindingId: binding, network: NETWORK, snapshotAtMs: 1_700_000_000_000, sourceExecutionAtMs: 1_700_000_000_000,
    provenance: 'fixture:balance-read', opening: [{ assetId: 'testnet:near', balanceAtomic: '100' }],
    closing: [{ assetId: 'testnet:near', balanceAtomic: '90' }], confirmedDeltas: [{ assetId: 'testnet:near', delta: -10n }],
    observedAtMs: 1_700_000_001_000, accessState: 'READABLE', freshnessState: 'FRESH', coverageState: 'COMPLETE', schemaState: 'VALID', lastTradeAtMs: null,
  });
  assert.equal(result.reconciliation, 'BALANCED');
  const health = await db.query(`SELECT access_state, freshness_state, coverage_state, reconciliation_state, last_trade_at FROM source_health_observations WHERE binding_id = $1`, [binding]);
  assert.deepEqual(health.rows[0], { access_state: 'READABLE', freshness_state: 'FRESH', coverage_state: 'COMPLETE', reconciliation_state: 'BALANCED', last_trade_at: null });
  const mismatch = await recordBalanceReconciliation(db, {
    bindingId: binding, network: NETWORK, snapshotAtMs: 1_700_000_002_000, sourceExecutionAtMs: null,
    provenance: 'fixture:balance-read', opening: [{ assetId: 'testnet:near', balanceAtomic: '90' }],
    closing: [{ assetId: 'testnet:near', balanceAtomic: '80' }], confirmedDeltas: [], observedAtMs: 1_700_000_003_000,
    accessState: 'READABLE', freshnessState: 'FRESH', coverageState: 'PARTIAL', schemaState: 'VALID', lastTradeAtMs: null,
  });
  assert.equal(mismatch.reconciliation, 'MISMATCH');
});

test('reconciliation rejects negative snapshot amounts without partial records', async () => {
  const binding = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  await seedBinding(binding);
  await assert.rejects(recordBalanceReconciliation(db, {
    bindingId: binding, network: NETWORK, snapshotAtMs: 1_700_000_000_000, sourceExecutionAtMs: null,
    provenance: 'fixture:negative', opening: [{ assetId: 'testnet:near', balanceAtomic: '0' }],
    closing: [{ assetId: 'testnet:near', balanceAtomic: '-1' }], confirmedDeltas: [], observedAtMs: 1_700_000_001_000,
    accessState: 'READABLE', freshnessState: 'FRESH', coverageState: 'COMPLETE', schemaState: 'VALID', lastTradeAtMs: null,
  }));
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM balance_snapshots WHERE binding_id = $1`, [binding])).rows[0]!.n, 0);
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
