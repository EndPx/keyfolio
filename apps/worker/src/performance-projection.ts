import {
  CALC_VERSION,
  computeMaxDrawdown,
  computeNetPnl,
  computeTimeWeightedReturn,
  formatSignedScaledUsd,
  parseScaledUsd,
  ratioMinusOneToBasisPoints,
  ratioToBasisPoints,
  sumEquity,
  type EquityInputItem,
} from '@keyfolio/domain';
type PublicPerformanceState = 'COMPLETE' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE';
export interface PublicPerformanceProjection {
  traderId: string; windowStart: string; windowEnd: string; pnlUsd: string | null; returnBps: string | null; drawdownBps: string | null;
  coverageStart: string | null; coverageEnd: string | null; coverage: 'COMPLETE' | 'PARTIAL' | 'UNKNOWN'; state: PublicPerformanceState;
  stale: boolean; calculationVersion: string; priceProvenance: string | null;
}

export interface QualifiedPriceSource {
  readonly capability: 'FIXTURE' | 'HISTORICAL' | 'LIVE';
  priceAt(assetId: string, atMs: number): { priceUsd: string; provenance: string } | null;
}

export interface ValuationPoint {
  atMs: number;
  balances: readonly EquityInputItem[];
}

export interface ExternalCashFlow { atMs: number; amountUsd: string; kind: 'DEPOSIT' | 'WITHDRAWAL' }

export interface PerformanceProjectionInput {
  traderId: string;
  windowStartMs: number;
  windowEndMs: number;
  valuationPoints: readonly ValuationPoint[];
  cashFlows: readonly ExternalCashFlow[];
  coverageStartMs: number | null;
  coverageEndMs: number | null;
  coverageComplete: boolean;
  sourceState: 'COMPLETE' | 'PARTIAL' | 'STALE';
  priceSource: QualifiedPriceSource;
  previousSnapshot?: StoredPublicSnapshot;
}

export interface StoredPublicSnapshot extends PublicPerformanceProjection {
  ledgerWatermark: string;
}

function iso(ms: number | null): string | null { return ms === null ? null : new Date(ms).toISOString(); }

function valueAt(point: ValuationPoint, source: QualifiedPriceSource): { value: bigint; provenance: string } | { reason: string } {
  const priced = point.balances.map((item) => {
    // Projection valuation always goes through the injected qualified source;
    // caller-supplied prices cannot silently bypass provenance/capability checks.
    const quote = source.priceAt(item.assetId, point.atMs);
    return { ...item, priceUsd: quote?.priceUsd ?? null, __provenance: quote?.provenance ?? null };
  });
  const equity = sumEquity(priced);
  if (!equity.complete) return { reason: equity.reason };
  const provenance = [...new Set(priced.map((p) => p.__provenance).filter((p): p is string => typeof p === 'string'))].sort().join(',') || null;
  return { value: equity.valueScaled, provenance: provenance ?? 'none' };
}

export function buildPublicPerformanceSnapshot(input: PerformanceProjectionInput): StoredPublicSnapshot {
  if (input.sourceState === 'STALE' && input.previousSnapshot) {
    return { ...input.previousSnapshot, state: 'STALE', stale: true, calculationVersion: CALC_VERSION };
  }
  if (input.valuationPoints.length < 2) {
    return unavailable(input, 'at least two valuation points are required');
  }
  const points = [...input.valuationPoints].sort((a, b) => a.atMs - b.atMs);
  const valued = points.map((point) => valueAt(point, input.priceSource));
  const provenance = [...new Set(valued.flatMap((v) => 'value' in v ? v.provenance.split(',') : []))].filter(Boolean).sort().join(',') || null;
  const first = valued[0];
  const last = valued[valued.length - 1];
  if (!('value' in first) || !('value' in last)) return unavailable(input, 'historical valuation boundary is unavailable', provenance);

  const flows = [...input.cashFlows].sort((a, b) => a.atMs - b.atMs);
  const deposits = flows.filter((f) => f.kind === 'DEPOSIT').reduce((n, f) => n + parseUsd(f.amountUsd), 0n);
  const withdrawals = flows.filter((f) => f.kind === 'WITHDRAWAL').reduce((n, f) => n + parseUsd(f.amountUsd), 0n);
  const pnl = computeNetPnl({ equityStartScaled: first.value, equityEndScaled: last.value, externalDepositsScaled: deposits, externalWithdrawalsScaled: withdrawals });
  const twrEvents: Array<{ kind: 'valuation'; valueScaled: bigint | null } | { kind: 'external_flow'; magnitudeScaled: bigint }> = [];
  for (const point of points) {
    const indexed = points.indexOf(point);
    const v = valued[indexed];
    if (!('value' in v)) { twrEvents.push({ kind: 'valuation', valueScaled: null }); } else twrEvents.push({ kind: 'valuation', valueScaled: v.value });
    for (const flow of flows.filter((f) => f.atMs === point.atMs)) twrEvents.push({ kind: 'external_flow', magnitudeScaled: parseUsd(flow.amountUsd) });
  }
  const twr = computeTimeWeightedReturn(twrEvents);
  const dd = valued.every((v) => 'value' in v) ? computeMaxDrawdown(valued.map((v) => ('value' in v ? v.value : 0n))) : { complete: false as const, reason: 'historical valuation boundary is unavailable' };
  const state: PublicPerformanceState = input.sourceState === 'STALE' ? 'STALE' : input.coverageComplete && twr.complete && dd.complete ? 'COMPLETE' : 'PARTIAL';
  return {
    traderId: input.traderId,
    windowStart: new Date(input.windowStartMs).toISOString(),
    windowEnd: new Date(input.windowEndMs).toISOString(),
    pnlUsd: pnl.complete ? formatSignedScaledUsd(pnl.pnlScaled) : null,
    returnBps: twr.complete ? ratioMinusOneToBasisPoints(twr.growth) : null,
    drawdownBps: dd.complete ? ratioToBasisPoints(dd.drawdown) : null,
    coverageStart: iso(input.coverageStartMs), coverageEnd: iso(input.coverageEndMs),
    coverage: input.coverageComplete ? 'COMPLETE' : 'PARTIAL', state, stale: state === 'STALE', calculationVersion: CALC_VERSION,
    priceProvenance: provenance,
    ledgerWatermark: `${input.windowStartMs}:${input.windowEndMs}:${CALC_VERSION}`,
  };
}

function unavailable(input: PerformanceProjectionInput, _reason: string, provenance: string | null = null): StoredPublicSnapshot {
  return { traderId: input.traderId, windowStart: new Date(input.windowStartMs).toISOString(), windowEnd: new Date(input.windowEndMs).toISOString(), pnlUsd: null, returnBps: null, drawdownBps: null, coverageStart: iso(input.coverageStartMs), coverageEnd: iso(input.coverageEndMs), coverage: 'UNKNOWN', state: input.sourceState === 'STALE' ? 'STALE' : 'UNAVAILABLE', stale: input.sourceState === 'STALE', calculationVersion: CALC_VERSION, priceProvenance: provenance, ledgerWatermark: `${input.windowStartMs}:${input.windowEndMs}:${CALC_VERSION}` };
}

function parseUsd(value: string): bigint {
  // Inputs are deliberately constrained to the exact domain parser by the caller's fixture.
  const result = parseScaledUsd(value);
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

export function toPublicReadModel(snapshot: StoredPublicSnapshot) {
  return {
    trader_id: snapshot.traderId, period: { start: snapshot.windowStart, end: snapshot.windowEnd }, pnl_atomic: null, pnl_usd: snapshot.pnlUsd,
    return_bps: snapshot.returnBps, drawdown_bps: snapshot.drawdownBps, coverage: snapshot.coverage,
    coverage_start: snapshot.coverageStart, coverage_end: snapshot.coverageEnd, state: snapshot.state, stale: snapshot.stale,
    calculation_version: snapshot.calculationVersion, price_provenance: snapshot.priceProvenance,
  };
}

export interface ProjectionDb { query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }> }

export async function persistPublicPerformanceSnapshot(db: ProjectionDb, snapshot: StoredPublicSnapshot): Promise<void> {
  await db.query(`INSERT INTO performance_snapshots
    (trader_id, window_start, window_end, pnl_usd, return_bps, drawdown_bps,
     coverage_start, coverage_end, coverage_state, snapshot_state, stale, calculation_version,
     price_provenance, ledger_watermark)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (trader_id, window_start, window_end, calculation_version) DO UPDATE SET
      pnl_usd=EXCLUDED.pnl_usd, return_bps=EXCLUDED.return_bps,
      drawdown_bps=EXCLUDED.drawdown_bps, coverage_start=EXCLUDED.coverage_start,
      coverage_end=EXCLUDED.coverage_end, coverage_state=EXCLUDED.coverage_state,
      snapshot_state=EXCLUDED.snapshot_state, stale=EXCLUDED.stale,
      price_provenance=EXCLUDED.price_provenance, ledger_watermark=EXCLUDED.ledger_watermark`,
    [snapshot.traderId, snapshot.windowStart, snapshot.windowEnd, snapshot.pnlUsd, snapshot.returnBps, snapshot.drawdownBps, snapshot.coverageStart, snapshot.coverageEnd, snapshot.coverage, snapshot.state, snapshot.stale, snapshot.calculationVersion, snapshot.priceProvenance, snapshot.ledgerWatermark]);
}
