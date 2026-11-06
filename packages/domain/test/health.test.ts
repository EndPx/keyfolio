import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COPY_MAX_AGE_MS,
  HOUR_MS,
  OUTAGE_THRESHOLD_MS,
  SOURCE_FRESHNESS_MS,
  applyObservation,
  countsAsSuccessfulRead,
  evaluateCopyEligibility,
  initialOutageState,
  isInOutage,
  isReadableIdleHealthy,
  outageDurationMs,
  validateEpochMs,
} from '../src/health.js';

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

test('validateEpochMs rejects NaN, Infinity, negative, fractional and unsafe values', () => {
  for (const ok of [0, 1, 120_000, MAX_SAFE, HOUR_MS * 1000]) {
    assert.deepEqual(validateEpochMs(ok), { ok: true, value: ok }, `expected ${ok} to validate`);
  }
  const bad: unknown[] = [
    NaN,
    Infinity,
    -Infinity,
    -1,
    -0.5,
    120_000.5,
    0.000001,
    MAX_SAFE + 1, // unsafe integer
    -(MAX_SAFE + 1),
    '0',
    null,
    undefined,
    {},
    [],
  ];
  for (const v of bad) {
    const r = validateEpochMs(v);
    assert.equal(r.ok, false, `expected rejection of ${String(v)}`);
    if (!r.ok) assert.ok(r.reason.length > 0);
  }
});

test('copy eligibility rejects NaN/Infinity/negative/fractional/unsafe/future timestamps', () => {
  const now = 1_000_000;
  const invalidTimes: unknown[] = [NaN, Infinity, -Infinity, -1, 1.5, MAX_SAFE + 1];
  for (const src of invalidTimes) {
    const v = evaluateCopyEligibility({ confirmed: true, sourceExecutionAtMs: src as number, nowMs: now });
    assert.deepEqual(v, { eligible: false, reason: 'invalid_timestamp' }, `source=${String(src)}`);
  }
  // invalid now also fails closed
  for (const n of [NaN, Infinity, -1, 1.5]) {
    const v = evaluateCopyEligibility({ confirmed: true, sourceExecutionAtMs: now, nowMs: n });
    assert.equal(v.eligible, false, `now=${String(n)}`);
  }
  // future source execution time denied
  assert.deepEqual(evaluateCopyEligibility({ confirmed: true, sourceExecutionAtMs: now + 1, nowMs: now }), {
    eligible: false,
    reason: 'future_timestamp',
  });
  // missing / not-confirmed paths remain intact
  assert.deepEqual(evaluateCopyEligibility({ confirmed: true, sourceExecutionAtMs: null, nowMs: now }), {
    eligible: false,
    reason: 'missing_timestamp',
  });
  assert.deepEqual(evaluateCopyEligibility({ confirmed: false, sourceExecutionAtMs: now, nowMs: now }), {
    eligible: false,
    reason: 'not_confirmed',
  });
});

test('copy eligibility uses the trusted execution time, not observed time (KF-D002)', () => {
  const now = 2_000_000;
  const fiveMinutes = COPY_MAX_AGE_MS;
  assert.deepEqual(evaluateCopyEligibility({ confirmed: true, sourceExecutionAtMs: now - fiveMinutes, nowMs: now }), {
    eligible: true,
    reason: 'eligible',
  });
  assert.equal(
    evaluateCopyEligibility({ confirmed: true, sourceExecutionAtMs: now - fiveMinutes - 1, nowMs: now }).eligible,
    false,
  );
  assert.equal(evaluateCopyEligibility({ confirmed: true, sourceExecutionAtMs: now - fiveMinutes + 1, nowMs: now }).eligible, true);
  // an old trade discovered "now" is still too old
  assert.equal(
    evaluateCopyEligibility({ confirmed: true, sourceExecutionAtMs: now - 60 * 60_000, nowMs: now }).eligible,
    false,
  );
});

test('freshness (120s) is separate from the 24h outage threshold', () => {
  assert.equal(SOURCE_FRESHNESS_MS, 120_000);
  assert.equal(OUTAGE_THRESHOLD_MS, 24 * HOUR_MS);
  const now = 10_000_000;

  // freshness boundaries
  assert.equal(isReadableIdleHealthy({ lastUsableAt: now - 120_000, now }), true, 'exactly 120s is fresh');
  assert.equal(isReadableIdleHealthy({ lastUsableAt: now - 119_999, now }), true);
  assert.equal(isReadableIdleHealthy({ lastUsableAt: now - 120_001, now }), false, '120s+1 is stale');
  // a 23h-old read is STALE (well past 120s), not healthy
  assert.equal(isReadableIdleHealthy({ lastUsableAt: now - 23 * HOUR_MS, now }), false);

  // out-of-order / future observation fails closed
  assert.equal(isReadableIdleHealthy({ lastUsableAt: 100, now: 0 }), false, 'out-of-order read is not healthy');
  assert.equal(isReadableIdleHealthy({ lastUsableAt: now + 1, now }), false, 'future read is not healthy');
  // null / invalid timestamps fail closed
  assert.equal(isReadableIdleHealthy({ lastUsableAt: null, now }), false);
  assert.equal(isReadableIdleHealthy({ lastUsableAt: NaN, now }), false);
  assert.equal(isReadableIdleHealthy({ lastUsableAt: now, now: Infinity }), false);
  assert.equal(isReadableIdleHealthy({ lastUsableAt: -1, now }), false);
  assert.equal(isReadableIdleHealthy({ lastUsableAt: now - 50.5, now }), false);
});

test('readable idle account stays healthy across repeated valid empty reads beyond 24h (KF-D001)', () => {
  let state = initialOutageState(0);
  // valid empty reads keep arriving while no trades ever occur
  for (const at of [0, 120_000, 6 * HOUR_MS, 23 * HOUR_MS, 24 * HOUR_MS, 30 * HOUR_MS, 48 * HOUR_MS]) {
    state = applyObservation(state, 'valid_empty', at);
    assert.equal(state.outageStartedAt, null, 'no outage from valid empty reads');
    assert.equal(isInOutage(state, at), false);
  }
  // the most recent read (still within its own 120s freshness window) is healthy
  assert.ok(state.lastUsableAt !== null);
  assert.equal(isReadableIdleHealthy({ lastUsableAt: state.lastUsableAt, now: state.lastUsableAt }), true);
});

test('unknown/unusable observations never count as a successful read and open an outage', () => {
  const start = 1000;
  let state = initialOutageState(start);
  state = applyObservation(state, 'unknown', start);
  assert.equal(state.outageStartedAt, start);
  assert.equal(state.lastUsableAt, null);

  for (const [q, t] of [['incomplete', 2000], ['auth_error', 3000], ['unknown', 4000]] as const) {
    state = applyObservation(state, q, t);
    assert.equal(state.outageStartedAt, start, `${q} must not reset outage`);
    assert.equal(state.lastUsableAt, null);
  }

  // 24h threshold: inclusive at exactly 24 continuous hours (>= threshold)
  const before = start + OUTAGE_THRESHOLD_MS - 1;
  const exact = start + OUTAGE_THRESHOLD_MS;
  const after = start + OUTAGE_THRESHOLD_MS + 1;
  assert.equal(isInOutage(state, before), false, 'just before 24h is not yet in outage');
  assert.equal(isInOutage(state, exact), true, 'exactly 24h of continuous outage is eligible');
  assert.equal(isInOutage(state, after), true, 'after 24h remains eligible');

  // a real usable read clears the outage
  state = applyObservation(state, 'usable', after + 1);
  assert.equal(state.outageStartedAt, null);
  assert.equal(state.lastUsableAt, after + 1);
});

test('isInOutage is inclusive at 24h and never eligible for invalid threshold/state or a healthy account', () => {
  const start = 1000;
  const inOutage = applyObservation(initialOutageState(0), 'unknown', start);

  // before / exact / after the 24h boundary (>= threshold)
  assert.equal(isInOutage(inOutage, start + OUTAGE_THRESHOLD_MS - 1), false, 'just before 24h is not yet in outage');
  assert.equal(isInOutage(inOutage, start + OUTAGE_THRESHOLD_MS), true, 'exactly 24h is eligible');
  assert.equal(isInOutage(inOutage, start + OUTAGE_THRESHOLD_MS + 1), true, 'after 24h remains eligible');

  // invalid thresholds fail closed even when the outage is long past 24h
  for (const t of [NaN, Infinity, -Infinity, -1, -0.5, 0.5, 1.5, MAX_SAFE + 1] as unknown[]) {
    assert.equal(isInOutage(inOutage, start + OUTAGE_THRESHOLD_MS + 1000, t as number), false, `threshold=${String(t)}`);
  }

  // a healthy state (no ongoing outage) is never eligible, even with threshold 0
  const healthy = initialOutageState(start);
  assert.equal(isInOutage(healthy, start + OUTAGE_THRESHOLD_MS), false);
  assert.equal(isInOutage(healthy, start, 0), false, 'healthy state with threshold 0 is not eligible');
  assert.equal(isInOutage(healthy, start, -1), false, 'healthy state with threshold -1 is not eligible');

  // invalid state (invalid outageStartedAt) is never eligible, even with threshold 0
  const invalidState = { outageStartedAt: NaN, lastUsableAt: null, now: start };
  assert.equal(isInOutage(invalidState, start, 0), false, 'invalid state with threshold 0 is not eligible');
  assert.equal(isInOutage(invalidState, start + OUTAGE_THRESHOLD_MS), false);

  // invalid now fails closed
  assert.equal(isInOutage(inOutage, NaN), false);
  assert.equal(isInOutage(inOutage, Infinity), false);

  // threshold 0 with an actual ongoing outage is eligible (duration >= 0)
  assert.equal(isInOutage(inOutage, start, 0), true, 'ongoing outage with threshold 0 is eligible');
});

test('applyObservation ignores invalid and out-of-order timestamps without regressing state', () => {
  let state = initialOutageState(10_000);
  state = applyObservation(state, 'usable', 20_000);
  assert.equal(state.lastUsableAt, 20_000);
  const snapshot = state;

  // invalid timestamps must not change state
  for (const bad of [NaN, Infinity, -1, 0.5, MAX_SAFE + 1]) {
    state = applyObservation(state, 'usable', bad);
    assert.deepEqual(state, snapshot, `invalid at=${String(bad)} must be ignored`);
  }
  // out-of-order (earlier than now) must not regress
  state = applyObservation(state, 'unknown', 15_000);
  assert.deepEqual(state, snapshot, 'out-of-order observation must be ignored');
});

test('outageDurationMs and isInOutage handle valid and invalid now safely', () => {
  const state = applyObservation(initialOutageState(0), 'unknown', 100);
  assert.equal(outageDurationMs(state, OUTAGE_THRESHOLD_MS + 100), OUTAGE_THRESHOLD_MS + 100 - 100);
  assert.equal(outageDurationMs(state, NaN), 0);
  assert.equal(outageDurationMs(state, Infinity), 0);
  assert.equal(outageDurationMs(state, 50), 0, 'now before outage start yields zero duration');
  assert.equal(countsAsSuccessfulRead('usable'), true);
  assert.equal(countsAsSuccessfulRead('valid_empty'), true);
  assert.equal(countsAsSuccessfulRead('unknown'), false);
  assert.equal(countsAsSuccessfulRead('auth_error'), false);
});