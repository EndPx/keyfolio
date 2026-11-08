// ILLUSTRATIVE FIXTURE DATA — never real trader performance.
// Served ONLY when KEYFOLIO_MODE=FIXTURE (enforced by the pages via
// getWebConfig); TESTNET/LIVE render an explicit not-connected state.
// Prices come from this plan CONFIGURATION (not hardcoded inside
// components); on TESTNET they will come from contract queries instead.

export interface PlanConfig {
  priceAtomic: string; // canonical atomic string in the subscription FT
  priceLabel: string; // display, formatted from priceAtomic
  paymentToken: string; // testnet mock FT
  termDays: number;
  termSeconds: number;
  storageNear: string; // native NEAR, separate from the price
  network: 'testnet';
}

export const PLAN: PlanConfig = {
  priceAtomic: '25000000', // 25.000000 KF-TEST @ 6 decimals
  priceLabel: '25 KF-TEST',
  paymentToken: 'KF-TEST (testnet mock FT)',
  termDays: 30,
  termSeconds: 2_592_000,
  storageNear: '0.10 NEAR (native — gas/storage)',
  network: 'testnet',
};

export type SellerState = 'complete' | 'partial' | 'insufficient';

export interface MarketSeller {
  id: string; // profile slug
  /** Xorr-style identity gradient: radial-gradient(circle at 32% 26%, c1, c2 74%). */
  gradient: [string, string];
  name: string;
  handle: string;
  state: SellerState;
  approach: string;
  /** Tracked return for the labeled window, or null when unavailable. */
  returnPct: number | null;
  netPnlUsd: number | null; // public net PnL is USD (baseline 01 section 8)
  maxDrawdownPct: number | null;
  settledSwaps: number | null;
  trackedSince: string;
  snapshotAt: string;
  priceLabel: string;
  salesActive: boolean;
  salesPausedReason: string | null;
}

export const MARKET_SELLERS: MarketSeller[] = [
  {
    id: 'carla',
    gradient: ['#5B93FF', '#1B44CE'],
    name: 'Carla',
    handle: 'carla.near',
    state: 'complete',
    approach:
      'Momentum on NEAR majors. Trades across supported interfaces — account-following includes activity placed outside Keyfolio.',
    returnPct: 8.24,
    netPnlUsd: 214.5,
    maxDrawdownPct: -3.1,
    settledSwaps: 148,
    trackedSince: 'Oct 8, 2026',
    snapshotAt: 'Nov 7, 2026 00:00 UTC',
    priceLabel: '25 KF-TEST / 30 days',
    salesActive: true,
    salesPausedReason: null,
  },
  {
    id: 'deltaone',
    gradient: ['#F0BE55', '#C98518'],
    name: 'DeltaOne',
    handle: 'deltaone.near',
    state: 'partial',
    approach:
      'Market-neutral basis. Partial coverage with disclosed gaps; complete-account metrics are disabled while gaps exist.',
    returnPct: null,
    netPnlUsd: null,
    maxDrawdownPct: null,
    settledSwaps: null,
    trackedSince: 'Oct 20, 2026',
    snapshotAt: 'Nov 7, 2026 00:00 UTC',
    priceLabel: '10 KF-TEST / 30 days',
    salesActive: false,
    salesPausedReason: 'Sales paused · partial coverage',
  },
  {
    id: 'esteban',
    gradient: ['#49E39B', '#12A45F'],
    name: 'Esteban',
    handle: 'esteban.near',
    state: 'insufficient',
    approach: 'Yield basis approach. Newly enrolled seller; performance publishing waits for a complete tracked window.',
    returnPct: null,
    netPnlUsd: null,
    maxDrawdownPct: null,
    settledSwaps: 12,
    trackedSince: 'Nov 5, 2026',
    snapshotAt: 'Nov 6, 2026 00:00 UTC',
    priceLabel: '15 KF-TEST / 30 days',
    salesActive: false,
    salesPausedReason: 'Sales paused · insufficient history',
  },
];

export function getSeller(id: string): MarketSeller | undefined {
  return MARKET_SELLERS.find((s) => s.id === id);
}

/** Tracked return (TWR) series in PERCENT for the public chart — no balances. */
export const CARLA_TWR_SERIES: { date: string; pct: number }[] = [
  { date: 'Oct 8', pct: 0 },
  { date: 'Oct 11', pct: 0.8 },
  { date: 'Oct 14', pct: 1.2 },
  { date: 'Oct 17', pct: 2.1 },
  { date: 'Oct 20', pct: 2.6 },
  { date: 'Oct 23', pct: 3.4 },
  { date: 'Oct 26', pct: 4.1 },
  { date: 'Oct 29', pct: 4.9 },
  { date: 'Nov 1', pct: 5.2 },
  { date: 'Nov 3', pct: 6.0 },
  { date: 'Nov 5', pct: 6.6 },
  { date: 'Nov 7', pct: 8.24 },
];

export const CARLA_PROFILE = {
  name: 'Carla',
  handle: 'carla.near',
  approach: 'Momentum on NEAR majors · tracking since Oct 8, 2026',
  trackedSince: 'Oct 8, 2026',
  snapshotAt: 'Nov 7, 2026 00:00 UTC',
  returnPct: 8.24,
  netPnlUsd: 214.5,
  maxDrawdownPct: -3.1,
  settledSwaps: 148,
};
