// Exact performance math (baseline 01 section 8, fixtures F-PNL/F-TWR/F-DD).
// Pure functions: no clocks, network, env or float arithmetic anywhere. USD
// values are carried as bigint integers scaled by USD_SCALE (10^12), prices as
// canonical decimal strings parsed exactly, ratios as exact numerator/denominator
// pairs so no intermediate result is ever rounded. CALC_VERSION must be bumped
// whenever any policy here changes so stored snapshots stay reproducible.

import { parseAtomicAmount } from './amount.js';

/** Internal USD resolution: values are bigint units of 10^-12 USD. */
export const USD_SCALE = 1_000_000_000_000n;

/** Version stamped on any persisted result derived from these rules. */
export const CALC_VERSION = 'kf-perf-v1' as const;

/** Canonical nonnegative USD decimal: no sign/exponent, at most 12 fraction digits. */
export const CANONICAL_USD_RE = /^(0|[1-9][0-9]*)(\.[0-9]{1,12})?$/;

/** Parse a canonical USD decimal string into the 10^-12 scaled bigint. */
export function parseScaledUsd(input: string): { ok: true; value: bigint } | { ok: false; reason: string } {
  if (typeof input !== 'string' || !CANONICAL_USD_RE.test(input)) {
    return {
      ok: false,
      reason:
        'usd value must be a canonical decimal string ^(0|[1-9][0-9]*)(\\.[0-9]{1,12})?$: no sign, exponent, whitespace or >12 fraction digits',
    };
  }
  const [intPart, fracPart = ''] = input.split('.');
  const fracPadded = fracPart.padEnd(12, '0');
  return { ok: true, value: BigInt(intPart + fracPadded) };
}

/** Format a scaled USD bigint back to a canonical decimal string (no trailing zeros). */
export function formatScaledUsd(scaled: bigint): string {
  if (scaled < 0n) throw new RangeError('formatScaledUsd requires a nonnegative scaled value');
  const intPart = scaled / USD_SCALE;
  const frac = (scaled % USD_SCALE).toString().padStart(12, '0').replace(/0+$/, '');
  return frac.length > 0 ? `${intPart}.${frac}` : intPart.toString();
}

export function formatSignedScaledUsd(scaled: bigint): string {
  if (scaled < 0n) return `-${formatScaledUsd(-scaled)}`;
  return formatScaledUsd(scaled);
}

/** Exact rational: den > 0, always reduced. */
export interface Ratio {
  num: bigint;
  den: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function makeRatio(num: bigint, den: bigint): Ratio {
  if (den === 0n) throw new RangeError('ratio denominator must not be zero');
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den) || 1n;
  return { num: num / g, den: den / g };
}

export function multiplyRatios(a: Ratio, b: Ratio): Ratio {
  return makeRatio(a.num * b.num, a.den * b.den);
}

/** growth - 1 as an exact ratio (can be negative). */
export function ratioMinusOne(r: Ratio): Ratio {
  return makeRatio(r.num - r.den, r.den);
}

/** Round-half-even scaled percent string, e.g. growth 11/10 -> "10.00" (2 digits). */
export function ratioToPercentString(r: Ratio, fractionDigits: number): string {
  if (!Number.isSafeInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 18) {
    throw new RangeError('fractionDigits must be a safe integer between 0 and 18');
  }
  const scalePow = BigInt(fractionDigits + 2); // +2 converts ratio to percent
  const numerator = r.num * 10n ** scalePow;
  const negative = numerator < 0n;
  const absNum = negative ? -numerator : numerator;
  let scaled = absNum / r.den;
  const remainder = absNum % r.den;
  const twice = remainder * 2n;
  if (twice > r.den || (twice === r.den && (scaled % 2n === 1n))) {
    scaled += 1n;
  }
  const sign = negative && scaled !== 0n ? '-' : '';
  const digits = scaled.toString().padStart(fractionDigits + 1, '0');
  if (fractionDigits === 0) return `${sign}${digits}`;
  const intPart = digits.slice(0, -fractionDigits);
  const fracPart = digits.slice(-fractionDigits);
  return `${sign}${intPart}.${fracPart}`;
}

/** Round a ratio (where 1.0 is flat) to signed basis points exactly. */
export function ratioMinusOneToBasisPoints(r: Ratio): string {
  const delta = ratioMinusOne(r);
  const numerator = delta.num * 10_000n;
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  let rounded = abs / delta.den;
  const remainder = abs % delta.den;
  if (remainder * 2n > delta.den || (remainder * 2n === delta.den && rounded % 2n === 1n)) rounded += 1n;
  return `${negative && rounded !== 0n ? '-' : ''}${rounded}`;
}

/** Round a nonnegative drawdown ratio to basis points exactly. */
export function ratioToBasisPoints(r: Ratio): string {
  const numerator = r.num * 10_000n;
  let rounded = numerator / r.den;
  const remainder = numerator % r.den;
  if (remainder * 2n > r.den || (remainder * 2n === r.den && rounded % 2n === 1n)) rounded += 1n;
  return rounded.toString();
}

// ---------------------------------------------------------------------------
// Equity aggregation (section 8: missing/unpriceable -> incomplete, never zero)
// ---------------------------------------------------------------------------

export interface EquityInputItem {
  assetId: string;
  /** Canonical atomic amount string (u128-bounded); zero balances are valid. */
  amountAtomic: string;
  /** Token decimals used to convert atomic units to whole units. */
  assetDecimals: number;
  /** Canonical USD decimal for one whole unit, or null when unpriced. */
  priceUsd: string | null;
}

export type EquityResult =
  | { complete: true; valueScaled: bigint }
  | { complete: false; reason: string };

/**
 * Sum asset values into scaled USD. A zero balance needs no price; any
 * positive balance without a valid positive price makes the whole equity
 * incomplete (P03: never substitute zero). Rounding policy: per-item floor at
 * 10^-12 USD, deterministic under replay.
 */
export function sumEquity(items: readonly EquityInputItem[]): EquityResult {
  let total = 0n;
  for (const item of items) {
    if (typeof item.assetId !== 'string' || item.assetId.length === 0) {
      return { complete: false, reason: 'assetId must be a nonempty string' };
    }
    const amount = parseAtomicAmount(item.amountAtomic);
    if (!amount.ok) return { complete: false, reason: `asset ${item.assetId}: ${amount.reason}` };
    const decimals = item.assetDecimals;
    if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 127) {
      return { complete: false, reason: `asset ${item.assetId}: assetDecimals must be 0..127` };
    }
    const amountBig = BigInt(amount.value);
    if (amountBig === 0n) continue; // zero balance contributes zero, price not required
    if (item.priceUsd === null || item.priceUsd === undefined) {
      return { complete: false, reason: `asset ${item.assetId}: price missing for positive balance` };
    }
    const price = parseScaledUsd(item.priceUsd);
    if (!price.ok) return { complete: false, reason: `asset ${item.assetId}: ${price.reason}` };
    if (price.value === 0n) {
      return { complete: false, reason: `asset ${item.assetId}: price must be positive` };
    }
    total += (amountBig * price.value) / 10n ** BigInt(decimals);
  }
  return { complete: true, valueScaled: total };
}

// ---------------------------------------------------------------------------
// Net PnL: equity_end - equity_start - deposits + withdrawals (all exact)
// ---------------------------------------------------------------------------

export type NetPnlInput = {
  equityStartScaled: bigint | null;
  equityEndScaled: bigint | null;
  /** Nonnegative external deposit magnitudes in scaled USD. */
  externalDepositsScaled: bigint | null;
  /** Nonnegative external withdrawal magnitudes in scaled USD. */
  externalWithdrawalsScaled: bigint | null;
};

export type NetPnlResult =
  | { complete: true; pnlScaled: bigint }
  | { complete: false; reason: string };

function nonnegativeScaled(name: string, v: bigint | null): string | null {
  if (v === null) return `${name} is missing`;
  if (typeof v !== 'bigint' || v < 0n) return `${name} must be a nonnegative scaled bigint`;
  return null;
}

export function computeNetPnl(input: NetPnlInput): NetPnlResult {
  for (const [name, v] of [
    ['equityStartScaled', input.equityStartScaled],
    ['equityEndScaled', input.equityEndScaled],
    ['externalDepositsScaled', input.externalDepositsScaled],
    ['externalWithdrawalsScaled', input.externalWithdrawalsScaled],
  ] as const) {
    const err = nonnegativeScaled(name, v);
    if (err) return { complete: false, reason: err };
  }
  const pnl =
    (input.equityEndScaled as bigint) -
    (input.equityStartScaled as bigint) -
    (input.externalDepositsScaled as bigint) +
    (input.externalWithdrawalsScaled as bigint);
  return { complete: true, pnlScaled: pnl };
}

// ---------------------------------------------------------------------------
// Time-weighted return: compound flow-free subperiod ratios (F-TWR)
// ---------------------------------------------------------------------------

export type TwrEvent =
  | { kind: 'valuation'; valueScaled: bigint | null }
  | { kind: 'external_flow'; magnitudeScaled: bigint };

export type TwrResult =
  | { complete: true; growth: Ratio }
  | { complete: false; reason: string };

/**
 * Compound flow-free subperiod returns. Requires a valuation after start and
 * after every flow, plus one immediately before every flow and at the end.
 * Any missing/nonpositive required valuation makes TWR incomplete. The result
 * is the growth ratio; net-PnL/starting-balance division is deliberately not
 * implemented anywhere (baseline 01 section 8).
 */
export function computeTimeWeightedReturn(events: readonly TwrEvent[]): TwrResult {
  if (events.length === 0) return { complete: false, reason: 'no events supplied' };
  let growth: Ratio | null = null;
  let segmentStart: bigint | null = null; // valuation opening the current subperiod
  let lastValuation: bigint | null = null; // most recent valuation seen
  let seenValuationSinceSegmentStart = false;

  const closeSubperiod = (): TwrResult | null => {
    if (segmentStart === null || lastValuation === null || !seenValuationSinceSegmentStart) {
      return { complete: false, reason: 'missing valuation at a cash-flow boundary' };
    }
    if (segmentStart <= 0n || lastValuation <= 0n) {
      return { complete: false, reason: 'nonpositive valuation at a cash-flow boundary' };
    }
    const sub = makeRatio(lastValuation, segmentStart);
    growth = growth === null ? sub : multiplyRatios(growth, sub);
    return null;
  };

  for (const event of events) {
    if (event.kind === 'valuation') {
      if (event.valueScaled !== null && (typeof event.valueScaled !== 'bigint' || event.valueScaled < 0n)) {
        return { complete: false, reason: 'valuation must be a nonnegative scaled bigint or null' };
      }
      if (segmentStart === null) {
        if (event.valueScaled === null) {
          return { complete: false, reason: 'missing valuation at the start' };
        }
        segmentStart = event.valueScaled;
      }
      lastValuation = event.valueScaled;
      seenValuationSinceSegmentStart = true;
    } else if (event.kind === 'external_flow') {
      if (typeof event.magnitudeScaled !== 'bigint' || event.magnitudeScaled < 0n) {
        return { complete: false, reason: 'external flow magnitude must be a nonnegative scaled bigint' };
      }
      const closed = closeSubperiod();
      if (closed) return closed;
      segmentStart = null;
      lastValuation = null;
      seenValuationSinceSegmentStart = false;
    } else {
      return { complete: false, reason: 'unknown TWR event kind' };
    }
  }
  const final = closeSubperiod();
  if (final) return final;
  if (growth === null) return { complete: false, reason: 'no subperiod return could be computed' };
  return { complete: true, growth };
}

// ---------------------------------------------------------------------------
// Maximum drawdown over a complete wealth index (F-DD)
// ---------------------------------------------------------------------------

export type MaxDrawdownResult =
  | { complete: true; drawdown: Ratio; peakIndex: number; troughIndex: number }
  | { complete: false; reason: string };

/**
 * Maximum peak-to-trough decline of a chronological wealth index using exact
 * ratios: max over i of (1 - v_i/peak_i). A leading zero segment contributes
 * no drawdown (no wealth to lose). Empty or invalid input is incomplete.
 */
export function computeMaxDrawdown(wealthIndex: readonly bigint[]): MaxDrawdownResult {
  if (wealthIndex.length === 0) return { complete: false, reason: 'wealth index is empty' };
  let peak = 0n;
  let peakIndex = -1;
  let best: { dd: Ratio; peakIndex: number; troughIndex: number } | null = null;
  for (let i = 0; i < wealthIndex.length; i += 1) {
    const v = wealthIndex[i];
    if (typeof v !== 'bigint' || v < 0n) {
      return { complete: false, reason: `wealth point ${i} must be a nonnegative scaled bigint` };
    }
    if (v > peak) {
      peak = v;
      peakIndex = i;
      continue;
    }
    if (peak > 0n && v < peak) {
      const dd = makeRatio(peak - v, peak);
      if (best === null || dd.num * best.dd.den > best.dd.num * dd.den) {
        best = { dd, peakIndex, troughIndex: i };
      }
    }
  }
  if (best === null) {
    return { complete: true, drawdown: makeRatio(0n, 1n), peakIndex: -1, troughIndex: -1 };
  }
  return { complete: true, drawdown: best.dd, peakIndex: best.peakIndex, troughIndex: best.troughIndex };
}
