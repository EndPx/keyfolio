import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublicPerformanceSnapshot, persistPublicPerformanceSnapshot, toPublicReadModel, type QualifiedPriceSource } from '../src/performance-projection.js';

const USD = (n: string) => [{ assetId: 'testnet:usd', amountAtomic: `${BigInt(n) * 1_000_000n}`, assetDecimals: 6, priceUsd: null }];
const prices: QualifiedPriceSource = { capability: 'FIXTURE', priceAt: () => ({ priceUsd: '1', provenance: 'fixture:qualified-price-v1' }) };
const at = (n: number) => 1_700_000_000_000 + n * 86_400_000;

test('KF-04 P01/P02/P06: exact metrics flow through worker projection and public allowlist', () => {
  const snapshot = buildPublicPerformanceSnapshot({
    traderId: 'trader-fixture', windowStartMs: at(0), windowEndMs: at(2),
    valuationPoints: [
      { atMs: at(0), balances: USD('1000') }, { atMs: at(1), balances: USD('1100') },
      { atMs: at(2), balances: USD('2000') },
    ],
    cashFlows: [{ atMs: at(1), amountUsd: '900', kind: 'DEPOSIT' }], coverageStartMs: at(0), coverageEndMs: at(2), coverageComplete: true, sourceState: 'COMPLETE', priceSource: prices,
  });
  assert.equal(snapshot.pnlUsd, '100');
  assert.equal(snapshot.returnBps, '1000');
  assert.equal(snapshot.drawdownBps, '0');
  const publicView = toPublicReadModel(snapshot) as Record<string, unknown>;
  assert.equal(publicView.trader_id, 'trader-fixture');
  for (const privateKey of ['balances', 'positions', 'activity_ids', 'source_token', 'provider_secret']) assert.equal(privateKey in publicView, false);
});

test('KF-04 P03/P05: missing historical price fails closed; stale source never becomes zero', () => {
  const missing: QualifiedPriceSource = { capability: 'FIXTURE', priceAt: (_asset, atMs) => atMs === at(2) ? null : { priceUsd: '1', provenance: 'fixture:qualified-price-v1' } };
  const unavailable = buildPublicPerformanceSnapshot({ traderId: 't', windowStartMs: at(0), windowEndMs: at(2), valuationPoints: [{ atMs: at(0), balances: USD('100') }, { atMs: at(2), balances: USD('100') }], cashFlows: [], coverageStartMs: at(0), coverageEndMs: null, coverageComplete: false, sourceState: 'PARTIAL', priceSource: missing });
  assert.equal(unavailable.state, 'UNAVAILABLE');
  assert.equal(unavailable.pnlUsd, null);
  const stale = buildPublicPerformanceSnapshot({ traderId: 't', windowStartMs: at(0), windowEndMs: at(2), valuationPoints: [{ atMs: at(0), balances: USD('100') }, { atMs: at(2), balances: USD('100') }], cashFlows: [], coverageStartMs: at(0), coverageEndMs: at(2), coverageComplete: true, sourceState: 'STALE', priceSource: prices });
  assert.equal(stale.state, 'STALE');
  assert.equal(stale.stale, true);
  const previous = { ...stale, state: 'COMPLETE' as const, stale: false, pnlUsd: '12' };
  const frozen = buildPublicPerformanceSnapshot({ traderId: 't', windowStartMs: at(0), windowEndMs: at(2), valuationPoints: [], cashFlows: [], coverageStartMs: at(0), coverageEndMs: at(2), coverageComplete: true, sourceState: 'STALE', priceSource: prices, previousSnapshot: previous });
  assert.equal(frozen.pnlUsd, '12');
  assert.equal(frozen.state, 'STALE');
});

test('KF-04 P04: already-net ledger valuation is not charged a duplicate fee', () => {
  const snapshot = buildPublicPerformanceSnapshot({ traderId: 'fee', windowStartMs: at(0), windowEndMs: at(1), valuationPoints: [{ atMs: at(0), balances: USD('1000') }, { atMs: at(1), balances: USD('1040') }], cashFlows: [], coverageStartMs: at(0), coverageEndMs: at(1), coverageComplete: true, sourceState: 'COMPLETE', priceSource: prices });
  assert.equal(snapshot.pnlUsd, '40');
});

test('KF-04 replay is deterministic and persistence is idempotent', async () => {
  const input = { traderId: 't-replay', windowStartMs: at(0), windowEndMs: at(2), valuationPoints: [{ atMs: at(0), balances: USD('1000') }, { atMs: at(1), balances: USD('1200') }, { atMs: at(2), balances: USD('1100') }], cashFlows: [], coverageStartMs: at(0), coverageEndMs: at(2), coverageComplete: true, sourceState: 'COMPLETE' as const, priceSource: prices };
  const a = buildPublicPerformanceSnapshot(input); const b = buildPublicPerformanceSnapshot(input);
  assert.deepEqual(a, b);
  const db = new PGlite();
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'api', 'migrations');
  for (const file of ['0001_initial.sql', '0002_cursor_version.sql', '0003_kf03_reconciliation.sql', '0004_kf04_performance_snapshots.sql']) await db.exec(`BEGIN;${readFileSync(join(dir, file), 'utf8')}COMMIT;`);
  await persistPublicPerformanceSnapshot(db, a); await persistPublicPerformanceSnapshot(db, b);
  const rows = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM performance_snapshots WHERE trader_id = $1', ['t-replay']);
  assert.equal(rows.rows[0]!.n, 1);
});
