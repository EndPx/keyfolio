import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CALC_VERSION,
  USD_SCALE,
  computeMaxDrawdown,
  computeNetPnl,
  computeTimeWeightedReturn,
  formatScaledUsd,
  parseScaledUsd,
  ratioMinusOne,
  ratioToPercentString,
  sumEquity,
} from '../src/performance.js';

const u = (wholeUsd: string): bigint => {
  const r = parseScaledUsd(wholeUsd);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
};

test('CALC_VERSION and USD scale are stable identifiers', () => {
  assert.equal(CALC_VERSION, 'kf-perf-v1');
  assert.equal(USD_SCALE, 10n ** 12n);
});

test('parseScaledUsd is exact and rejects sign/exponent/overflow-fraction forms', () => {
  assert.deepEqual(parseScaledUsd('1000'), { ok: true, value: 1000n * USD_SCALE });
  assert.deepEqual(parseScaledUsd('0.5'), { ok: true, value: 500_000_000_000n });
  assert.deepEqual(parseScaledUsd('1.123456789012'), { ok: true, value: 1123456789012n });
  for (const bad of ['-1', '+1', '1e3', ' 1', '', '.', '1.', '01', '1.1234567890123', '1,5', '1.5d', null, 1.5]) {
    assert.equal((parseScaledUsd(bad as string) as { ok: boolean }).ok, false, `expected reject ${String(bad)}`);
  }
});

test('formatScaledUsd round-trips canonical decimals without trailing zeros', () => {
  assert.equal(formatScaledUsd(50n * USD_SCALE), '50');
  assert.equal(formatScaledUsd(500_000_000_000n), '0.5');
  assert.equal(formatScaledUsd(0n), '0');
  assert.equal(formatScaledUsd(1n), '0.000000000001');
  assert.equal(formatScaledUsd(1_500_000_000_000n), '1.5');
});

// F-PNL: opening 1000; deposit 500; withdrawal 100; ending 1450 -> net PnL 50.
test('F-PNL: deposit/withdrawal example yields exactly 50 USD net PnL', () => {
  const r = computeNetPnl({
    equityStartScaled: u('1000'),
    equityEndScaled: u('1450'),
    externalDepositsScaled: u('500'),
    externalWithdrawalsScaled: u('100'),
  });
  assert.deepEqual(r, { complete: true, pnlScaled: u('50') });
  assert.equal(formatScaledUsd(r.complete ? r.pnlScaled : 0n), '50');
});

test('F-PNL: deposit-only case yields exactly zero PnL', () => {
  const r = computeNetPnl({
    equityStartScaled: u('1000'),
    equityEndScaled: u('1500'),
    externalDepositsScaled: u('500'),
    externalWithdrawalsScaled: u('0'),
  });
  assert.deepEqual(r, { complete: true, pnlScaled: 0n });
});

test('net PnL is incomplete when any component is missing (never zero)', () => {
  const r = computeNetPnl({
    equityStartScaled: u('1000'),
    equityEndScaled: null,
    externalDepositsScaled: u('500'),
    externalWithdrawalsScaled: u('0'),
  });
  assert.equal(r.complete, false);
  if (!r.complete) assert.match(r.reason, /equityEndScaled/);
});

test('net PnL rejects negative component magnitudes', () => {
  const r = computeNetPnl({
    equityStartScaled: u('1000'),
    equityEndScaled: u('1000'),
    externalDepositsScaled: -u('1'),
    externalWithdrawalsScaled: u('0'),
  });
  assert.equal(r.complete, false);
});

test('sumEquity: unpriced positive balance is incomplete, zero balance needs no price (P03)', () => {
  const unpriced = sumEquity([
    { assetId: 'near', amountAtomic: '1000000000000000000000000', assetDecimals: 24, priceUsd: '5' },
    { assetId: 'usdc', amountAtomic: '15000000', assetDecimals: 6, priceUsd: null },
  ]);
  assert.equal(unpriced.complete, false);
  if (!unpriced.complete) assert.match(unpriced.reason, /usdc: price missing/);

  const zeroBalanceUnpriced = sumEquity([
    { assetId: 'near', amountAtomic: '0', assetDecimals: 24, priceUsd: null },
  ]);
  assert.deepEqual(zeroBalanceUnpriced, { complete: true, valueScaled: 0n });

  const badPrice = sumEquity([
    { assetId: 'near', amountAtomic: '1', assetDecimals: 24, priceUsd: '0' },
  ]);
  assert.equal(badPrice.complete, false);
  if (!badPrice.complete) assert.match(badPrice.reason, /price must be positive/);
});

test('sumEquity computes exact scaled USD with per-item floor at 10^-12', () => {
  // 2 NEAR at 5 USD = 10 USD; 15,000,000 of 6-decimal USDC at 1 USD = 15 USD.
  const r = sumEquity([
    { assetId: 'near', amountAtomic: '2000000000000000000000000', assetDecimals: 24, priceUsd: '5' },
    { assetId: 'usdc', amountAtomic: '15000000', assetDecimals: 6, priceUsd: '1' },
  ]);
  assert.deepEqual(r, { complete: true, valueScaled: u('25') });
  // Sub-10^-12 residue floors: 1 atomic unit of an 18-decimal token at price 1.
  const floored = sumEquity([{ assetId: 'x', amountAtomic: '1', assetDecimals: 18, priceUsd: '1' }]);
  assert.deepEqual(floored, { complete: true, valueScaled: 0n });
});

// F-TWR: 1000 -> 1100 before deposit; deposit 900 -> 2000; end 2000. Growth 11/10.
test('F-TWR: cash-flow-adjusted example yields exactly 10% TWR (not PnL/capital)', () => {
  const r = computeTimeWeightedReturn([
    { kind: 'valuation', valueScaled: u('1000') },
    { kind: 'valuation', valueScaled: u('1100') },
    { kind: 'external_flow', magnitudeScaled: u('900') },
    { kind: 'valuation', valueScaled: u('2000') },
    { kind: 'valuation', valueScaled: u('2000') },
  ]);
  assert.equal(r.complete, true);
  if (r.complete) {
    assert.equal(ratioToPercentString(ratioMinusOne(r.growth), 2), '10.00');
    // The wrong shortcut (100 net / 1900 cumulative or /1000 start) must not be reachable:
    assert.equal(r.growth.num, 11n);
    assert.equal(r.growth.den, 10n);
  }
});

test('TWR is incomplete when a boundary valuation is missing or nonpositive', () => {
  // A flow with no valuation since the previous boundary lacks the pre-flow value.
  const missingBoundary = computeTimeWeightedReturn([
    { kind: 'valuation', valueScaled: u('1000') },
    { kind: 'external_flow', magnitudeScaled: u('900') },
    { kind: 'external_flow', magnitudeScaled: u('0') },
    { kind: 'valuation', valueScaled: u('2000') },
  ]);
  assert.equal(missingBoundary.complete, false);
  if (!missingBoundary.complete) assert.match(missingBoundary.reason, /cash-flow boundary/);

  const missingEnd = computeTimeWeightedReturn([
    { kind: 'valuation', valueScaled: u('1000') },
    { kind: 'external_flow', magnitudeScaled: u('100') },
  ]);
  assert.equal(missingEnd.complete, false);

  const zeroBoundary = computeTimeWeightedReturn([
    { kind: 'valuation', valueScaled: 0n },
    { kind: 'external_flow', magnitudeScaled: u('1') },
    { kind: 'valuation', valueScaled: u('1') },
  ]);
  assert.equal(zeroBoundary.complete, false);
  if (!zeroBoundary.complete) assert.match(zeroBoundary.reason, /nonpositive/);

  const empty = computeTimeWeightedReturn([]);
  assert.equal(empty.complete, false);
});

test('TWR ignores intermediate incomplete valuations that are not boundaries', () => {
  const r = computeTimeWeightedReturn([
    { kind: 'valuation', valueScaled: u('1000') },
    { kind: 'valuation', valueScaled: null },
    { kind: 'valuation', valueScaled: u('1100') },
    { kind: 'external_flow', magnitudeScaled: u('900') },
    { kind: 'valuation', valueScaled: u('2000') },
    { kind: 'valuation', valueScaled: u('2000') },
  ]);
  assert.equal(r.complete, true);
  if (r.complete) assert.equal(ratioToPercentString(ratioMinusOne(r.growth), 2), '10.00');
});

// F-DD: wealth 1.00 -> 1.20 -> 0.90 -> 1.10 -> max drawdown 25%.
test('F-DD: wealth index yields exactly 25% maximum drawdown', () => {
  const r = computeMaxDrawdown([u('1.00'), u('1.20'), u('0.90'), u('1.10')]);
  assert.equal(r.complete, true);
  if (r.complete) {
    assert.equal(ratioToPercentString(r.drawdown, 2), '25.00');
    assert.equal(r.peakIndex, 1);
    assert.equal(r.troughIndex, 2);
  }
});

test('max drawdown picks the deepest decline and handles flat/zero/incomplete inputs', () => {
  const flat = computeMaxDrawdown([u('5'), u('5'), u('5')]);
  assert.deepEqual(flat.complete ? flat.drawdown : null, { num: 0n, den: 1n });

  const deepest = computeMaxDrawdown([u('10'), u('9'), u('9.5'), u('4')]);
  assert.equal(deepest.complete, true);
  if (deepest.complete) {
    assert.equal(ratioToPercentString(deepest.drawdown, 2), '60.00');
    assert.equal(deepest.troughIndex, 3);
  }

  const leadingZero = computeMaxDrawdown([0n, u('2'), u('1')]);
  assert.equal(leadingZero.complete, true);
  if (leadingZero.complete) assert.equal(ratioToPercentString(leadingZero.drawdown, 2), '50.00');

  const empty = computeMaxDrawdown([]);
  assert.equal(empty.complete, false);

  const invalid = computeMaxDrawdown([u('1'), -u('1')]);
  assert.equal(invalid.complete, false);
});

test('ratioToPercentString rounds half-even and keeps signs exact', () => {
  // 1/8 = 12.5% at 1 digit: exactly half -> round to even -> "12.5"->"12.5"? 12.5 -> 12.5 needs 1 digit.
  assert.equal(ratioToPercentString({ num: 1n, den: 8n }, 1), '12.5');
  // 1/16 = 6.25% at 1 digit: 62.5 -> half -> even 62 -> "6.2"
  assert.equal(ratioToPercentString({ num: 1n, den: 16n }, 1), '6.2');
  // Negative growth; a negative zero percent is suppressed (never "-0").
  assert.equal(ratioToPercentString({ num: -1n, den: 10n }, 2), '-10.00');
  assert.equal(ratioToPercentString({ num: -1n, den: 10n ** 15n * 10n }, 12), '0.000000000000');
});
