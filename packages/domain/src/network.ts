// Substrate network identity. All account/contract/token/receipt identities
// are network-scoped; unknown network ids are rejected, never defaulted.

export const KNOWN_NETWORKS = ['mainnet', 'testnet'] as const;
export type KnownNetwork = (typeof KNOWN_NETWORKS)[number];

export type NetworkParseResult =
  | { ok: true; value: KnownNetwork }
  | { ok: false; reason: string };

export function parseNetwork(input: unknown): NetworkParseResult {
  if (input === 'mainnet' || input === 'testnet') {
    return { ok: true, value: input };
  }
  return {
    ok: false,
    reason: `unknown network ${JSON.stringify(String(input))}: expected one of mainnet, testnet`,
  };
}