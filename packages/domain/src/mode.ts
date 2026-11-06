// Explicit runtime modes. KEYFOLIO_MODE is mandatory; there is no default and
// a missing/unknown value never silently falls back to the fixture mode.

export const KEYFOLIO_MODES = ['FIXTURE', 'TESTNET', 'LIVE'] as const;
export type KeyfolioMode = (typeof KEYFOLIO_MODES)[number];

export type ModeParseResult =
  | { ok: true; value: KeyfolioMode }
  | { ok: false; reason: string };

export function parseMode(input: unknown): ModeParseResult {
  if (typeof input !== 'string' || input.length === 0) {
    return {
      ok: false,
      reason: 'KEYFOLIO_MODE is required and must be exactly one of FIXTURE, TESTNET, LIVE',
    };
  }
  if ((KEYFOLIO_MODES as readonly string[]).includes(input)) {
    return { ok: true, value: input as KeyfolioMode };
  }
  return {
    ok: false,
    reason: `unknown KEYFOLIO_MODE "${input}": expected one of FIXTURE, TESTNET, LIVE`,
  };
}