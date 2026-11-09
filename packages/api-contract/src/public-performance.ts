import type { PublicPerformance } from './keyfolio-v1.js';

export type PublicPerformanceState = 'COMPLETE' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE';

/** Internal projection shape accepted by the public allowlist. */
export interface PublicPerformanceProjection {
  traderId: string;
  windowStart: string;
  windowEnd: string;
  pnlUsd: string | null;
  returnBps: string | null;
  drawdownBps: string | null;
  coverageStart: string | null;
  coverageEnd: string | null;
  coverage: 'COMPLETE' | 'PARTIAL' | 'UNKNOWN';
  state: PublicPerformanceState;
  stale: boolean;
  calculationVersion: string;
  priceProvenance: string | null;
}

/**
 * Public read-model seam. It intentionally copies an allowlist; private
 * balances, positions, activity ids, provider payloads and secrets cannot
 * cross this boundary even if they exist on the worker result.
 */
export function serializePublicPerformance(projection: PublicPerformanceProjection): PublicPerformance & {
  coverage_start: string | null;
  coverage_end: string | null;
  state: PublicPerformanceState;
  stale: boolean;
  calculation_version: string;
  price_provenance: string | null;
} {
  return {
    trader_id: projection.traderId,
    period: { start: projection.windowStart, end: projection.windowEnd },
    pnl_atomic: null,
    pnl_usd: projection.pnlUsd,
    return_bps: projection.returnBps,
    drawdown_bps: projection.drawdownBps,
    coverage: projection.coverage,
    coverage_start: projection.coverageStart,
    coverage_end: projection.coverageEnd,
    state: projection.state,
    stale: projection.stale,
    calculation_version: projection.calculationVersion,
    price_provenance: projection.priceProvenance,
  };
}
