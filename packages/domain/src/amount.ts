// Canonical atomic amount: an unsigned 128-bit integer expressed ONLY as a
// canonical decimal string matching ^(0|[1-9][0-9]*)$. Validation never
// coerces, rounds or truncates a number input. JSON numbers (1.5, 1.0, 123)
// are rejected outright, exactly like the strings "1.5", "01", "-1", "1e3".

export const UINT128_MAX_STR = '340282366920938463463374607431768211455' as const;
export const UINT128_MAX = 340282366920938463463374607431768211455n;

/** Canonical unsigned digits: "0" or a nonzero first digit, no sign/decimal/exponent/whitespace. */
export const CANONICAL_UINT_RE = /^(0|[1-9][0-9]*)$/;

/** Canonical signed digits: "0", or an optional "-" followed by a nonzero first digit. Rejects "-0", "+1", "01". */
export const CANONICAL_SIGNED_RE = /^(0|-?[1-9][0-9]*)$/;

export type ParseResult<T extends string = string> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

function describeType(input: unknown): string {
  if (input === null) return 'null';
  if (Array.isArray(input)) return 'array';
  return typeof input;
}

export function isCanonicalUintString(input: string): boolean {
  return CANONICAL_UINT_RE.test(input);
}

/**
 * Strictly parse a canonical atomic amount. The input MUST already be a
 * string; any JSON number is rejected to prevent float/scientific coercion.
 */
export function parseAtomicAmount(input: unknown): ParseResult {
  if (typeof input !== 'string') {
    return { ok: false, reason: `amount must be a JSON string; got ${describeType(input)}` };
  }
  if (input.length === 0) {
    return { ok: false, reason: 'amount must not be empty' };
  }
  if (!CANONICAL_UINT_RE.test(input)) {
    return {
      ok: false,
      reason:
        'amount must be a canonical integer string ^(0|[1-9][0-9]*)$: no sign, decimal, exponent, whitespace or leading zeros',
    };
  }
  if (input.length > UINT128_MAX_STR.length) {
    return { ok: false, reason: `amount has ${input.length} digits, exceeding the 39-digit u128 limit` };
  }
  // The string matches the canonical regex, so BigInt parsing is exact (no
  // rounding or coercion) and safe for up to 39 digits.
  const magnitude = BigInt(input);
  if (magnitude > UINT128_MAX) {
    return { ok: false, reason: `amount exceeds u128 maximum ${UINT128_MAX_STR}` };
  }
  return { ok: true, value: input };
}

export function assertAtomicAmount(input: unknown): string {
  const result = parseAtomicAmount(input);
  if (!result.ok) throw new RangeError(result.reason);
  return result.value;
}

/** A plan price is a canonical atomic amount that must be strictly greater than zero. */
export function parsePlanPrice(input: unknown): ParseResult {
  const result = parseAtomicAmount(input);
  if (!result.ok) return result;
  if (result.value === '0') {
    return { ok: false, reason: 'plan price must be greater than zero' };
  }
  return result;
}

/**
 * Signed ledger delta: separately validated canonical signed integer string.
 * "0" is allowed; "-0" and other non-canonical forms are rejected. Magnitude
 * is bounded by the same u128 maximum.
 */
export function parseSignedAtomicDelta(input: unknown): ParseResult {
  if (typeof input !== 'string') {
    return { ok: false, reason: `signed delta must be a JSON string; got ${describeType(input)}` };
  }
  if (input.length === 0) {
    return { ok: false, reason: 'signed delta must not be empty' };
  }
  if (!CANONICAL_SIGNED_RE.test(input)) {
    return {
      ok: false,
      reason:
        'signed delta must be a canonical signed integer ^(0|-?[1-9][0-9]*)$: no -0, +, decimal, exponent, whitespace or leading zeros',
    };
  }
  const negative = input[0] === '-';
  const magnitude = negative ? input.slice(1) : input;
  if (magnitude.length > UINT128_MAX_STR.length) {
    return { ok: false, reason: `signed delta magnitude has ${magnitude.length} digits, exceeding the 39-digit u128 limit` };
  }
  const n = magnitude === '0' ? 0n : BigInt(magnitude);
  if (n > UINT128_MAX) {
    return { ok: false, reason: `signed delta magnitude exceeds u128 maximum ${UINT128_MAX_STR}` };
  }
  return { ok: true, value: input };
}