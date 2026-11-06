// Browser-safe runtime schemas for the KF-02a amount validation seam and the
// health response. Validation reuses the pure domain parsers and therefore
// never coerces, rounds or truncates an input.

import { parseAtomicAmount, parseNetwork } from '@keyfolio/domain';

export type AtomicAmount = string; // canonical ^(0|[1-9][0-9]*)$, <= u128 max

export interface HealthData {
  mode: string;
  build: {
    name: string;
    version: string;
    commit: string;
  };
  network: string | null;
  /** Deliberately not "ready": this slice has no provider readiness to report. */
  provider: 'unconfigured';
}

export type ValidateAmountResponse =
  | { valid: true; amount: AtomicAmount; network: string | null }
  | { valid: false; code: 'invalid_amount' | 'unknown_network'; reason: string };

/**
 * Strictly validate an amount-validation request body. `amount` MUST be a
 * canonical string; JSON numbers are rejected. `network`, when present, must be
 * a known network id.
 */
export function validateAmountRequest(body: unknown): ValidateAmountResponse {
  const record = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const amount = parseAtomicAmount(record.amount);
  if (!amount.ok) {
    return { valid: false, code: 'invalid_amount', reason: amount.reason };
  }
  let network: string | null = null;
  if (record.network !== undefined && record.network !== null) {
    const parsed = parseNetwork(record.network);
    if (!parsed.ok) {
      return { valid: false, code: 'unknown_network', reason: parsed.reason };
    }
    network = parsed.value;
  }
  return { valid: true, amount: amount.value, network };
}