// NEP-141 ft_transfer_call result decoding (review checkpoint: findings on
// runTx values). The resolver returns the SPENT amount as a JSON-encoded
// U128 string, e.g. raw base64-decodes to '"101"'. Decoding is strict:
// empty, malformed or non-string values throw instead of being guessed.

/**
 * Decode the raw SuccessValue text of an ft_transfer_call into the spent
 * amount string. `raw` is the base64-decoded SuccessValue text (may be null
 * when the chain returned no value). Throws on empty/malformed input.
 */
export function parseResolverValue(raw) {
  if (raw === null || raw === undefined || raw === '') {
    throw new Error(`resolver returned no value (raw=${JSON.stringify(raw)}): cannot verify spent amount`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`resolver returned malformed value: ${JSON.stringify(raw)}`);
  }
  if (typeof parsed !== 'string' || !/^(0|[1-9][0-9]*)$/.test(parsed)) {
    throw new Error(
      `resolver value is not a canonical U128 string: ${JSON.stringify(raw)}`,
    );
  }
  return parsed;
}

/**
 * Assert the spent amount equals `expected` exactly (string compare).
 * Anything else — including "0" (full refund) — throws with context.
 */
export function assertSpentAmount(raw, expected, context) {
  const spent = parseResolverValue(raw);
  if (spent !== expected) {
    throw new Error(
      `${context}: resolver spent ${spent}, expected ${expected} (a full refund would be "0")`,
    );
  }
  return spent;
}
