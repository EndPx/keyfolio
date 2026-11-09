// First-buyer checkout preflight (KF-08b) — aggregates every on-chain check
// that must pass before a purchase is enabled. READ-ONLY: no transactions, no
// signing, no storage deposits. Metadata failure is a BLOCKING error (no
// hardcoded 6-decimal fallback); storage/gas is native NEAR and is kept
// separate from the FT price; every probe records a block/fetched-at context.

import {
  createTestnetClient,
  normalizeAtomicU128,
  type BlockContext,
  type ContractInfo,
  type FtMetadata,
  type PlanJson,
  type TestnetClientConfig,
  type TraderJson,
} from './testnet';

export interface PreflightGate {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface PreflightReady {
  phase: 'ready';
  fetchedAtMs: number;
  block: BlockContext | null;
  info: ContractInfo;
  ft: FtMetadata | null;
  ftDeployed: boolean;
  ftDecimals: number | null;
  ftSymbol: string | null;
  plan: PlanJson | null;
  trader: TraderJson | null;
  /** ACCESS prepaid native storage minimum (yoctoNEAR). */
  storageMinimum: string | null;
  /** Buyer's prepaid ACCESS storage (yoctoNEAR), when connected. */
  buyerStorage: string | null;
  /** Buyer's FT balance (atomic), when connected. */
  buyerFtBalance: string | null;
  buyerFtRegistered: boolean;
  accessFtRegistered: boolean;
  gates: PreflightGate[];
  /** Non-fatal probe failures (block fetch, individual views) surfaced verbatim. */
  warnings: string[];
}

export type PreflightResult =
  | PreflightReady
  | { phase: 'error'; fetchedAtMs: number; message: string };

/** A result older than this no longer enables purchase actions. */
export const PREFLIGHT_STALE_MS = 30_000;

export function isPreflightStale(result: PreflightReady, nowMs = Date.now()): boolean {
  return nowMs - result.fetchedAtMs > PREFLIGHT_STALE_MS;
}

/** All blocking gates must be true AND the result fresh for a prepared purchase. */
export function canPurchase(result: PreflightReady, nowMs = Date.now()): boolean {
  return !isPreflightStale(result, nowMs) && result.gates.every((g) => g.ok);
}

function gate(id: string, label: string, ok: boolean, detail?: string): PreflightGate {
  return ok ? { id, label, ok } : { id, label, ok, detail };
}

export async function runCheckoutPreflight(
  cfg: TestnetClientConfig,
  traderId: string,
  buyerId: string | null,
): Promise<PreflightResult> {
  const client = createTestnetClient(cfg);
  const fetchedAtMs = Date.now();
  const warnings: string[] = [];

  let block: BlockContext | null = null;
  try {
    block = await client.viewBlock();
  } catch (err) {
    warnings.push(`block: ${String((err as Error).message ?? err).slice(0, 160)}`);
  }

  // contract_info is the root of everything: without it we cannot even say
  // which FT / network we are talking to.
  let info: ContractInfo;
  try {
    info = await client.viewContractInfo();
  } catch (err) {
    return { phase: 'error', fetchedAtMs, message: String((err as Error).message ?? err).slice(0, 240) };
  }

  const ftId = info.ft_id;

  let trader: TraderJson | null = null;
  try {
    trader = await client.viewTrader(traderId);
  } catch (err) {
    warnings.push(`get_trader: ${String((err as Error).message ?? err).slice(0, 160)}`);
  }

  let plan: PlanJson | null = null;
  try {
    plan = await client.viewCurrentPlan(traderId);
  } catch (err) {
    warnings.push(`get_current_plan: ${String((err as Error).message ?? err).slice(0, 160)}`);
  }

  // FT deployment/readability (code hash) — metadata is a stricter gate below.
  let ftDeployed = false;
  try {
    const code = await client.viewCode(ftId);
    ftDeployed = typeof code.code_base64 === 'string' && code.code_base64.length > 0;
  } catch {
    ftDeployed = false;
  }

  let ft: FtMetadata | null = null;
  try {
    ft = await client.viewFtMetadata(ftId);
  } catch (err) {
    warnings.push(`ft_metadata: ${String((err as Error).message ?? err).slice(0, 160)}`);
  }

  // ACCESS must be registered as an FT receiver before ft_transfer_call works.
  let accessFtRegistered = false;
  try {
    accessFtRegistered = (await client.viewFtStorageBalanceOf(ftId, cfg.accessContract)) !== null;
  } catch (err) {
    warnings.push(`ft storage_balance_of(access): ${String((err as Error).message ?? err).slice(0, 160)}`);
  }

  let storageMinimum: string | null = null;
  try {
    storageMinimum = normalizeAtomicU128(await client.viewStorageMinimumBalance());
  } catch (err) {
    warnings.push(`storage_minimum_balance: ${String((err as Error).message ?? err).slice(0, 160)}`);
  }

  let buyerFtBalance: string | null = null;
  let buyerFtRegistered = false;
  let buyerStorage: string | null = null;
  if (buyerId) {
    try {
      buyerFtBalance = normalizeAtomicU128(await client.viewFtBalanceOf(ftId, buyerId));
    } catch (err) {
      warnings.push(`ft_balance_of(buyer): ${String((err as Error).message ?? err).slice(0, 160)}`);
    }
    try {
      buyerFtRegistered = (await client.viewFtStorageBalanceOf(ftId, buyerId)) !== null;
    } catch (err) {
      warnings.push(`ft storage_balance_of(buyer): ${String((err as Error).message ?? err).slice(0, 160)}`);
    }
    try {
      buyerStorage = normalizeAtomicU128(await client.viewStorageBalanceOf(buyerId));
    } catch (err) {
      warnings.push(`storage_balance_of(buyer): ${String((err as Error).message ?? err).slice(0, 160)}`);
    }
  }

  const decimals = ft ? ft.decimals : null;
  const symbol = ft ? ft.symbol : null;

  const planActive = plan !== null && plan.active;
  const salesOk = trader !== null && trader.sales_enabled && !trader.terminated;

  const enoughFtBalance =
    buyerId !== null &&
    buyerFtBalance !== null &&
    plan !== null &&
    BigInt(buyerFtBalance) >= BigInt(plan.price);

  const enoughStorage =
    buyerId !== null &&
    buyerStorage !== null &&
    storageMinimum !== null &&
    BigInt(buyerStorage) >= BigInt(storageMinimum);

  const gates: PreflightGate[] = [
    gate(
      'block-context',
      'Finalized block context readable',
      block !== null,
      block !== null ? `height=${block.height}` : 'finality/block unreadable — purchase disabled',
    ),
    gate(
      'ft-deployed',
      `Subscription FT deployed at ${ftId}`,
      ftDeployed,
      ftDeployed ? undefined : 'FT account has no deployed code',
    ),
    gate(
      'ft-metadata',
      'FT metadata readable (decimals + symbol)',
      ft !== null,
      ft !== null
        ? `decimals=${ft.decimals}, symbol=${ft.symbol}`
        : 'ft_metadata failed — no decimals fallback is allowed',
    ),
    gate(
      'ft-access-registered',
      'ACCESS contract registered with the FT (receiver)',
      accessFtRegistered,
      accessFtRegistered ? undefined : 'ACCESS has no FT storage registration',
    ),
    gate('plan-active', 'Plan published and active', planActive, planActive ? undefined : 'no active plan'),
    gate('trader-sales', 'Seller sales enabled (not terminated)', salesOk, salesOk ? undefined : 'sales paused or terminated'),
    gate(
      'buyer-ft-balance',
      buyerId ? 'Buyer holds enough subscription FT' : 'Wallet connected (buyer FT balance)',
      enoughFtBalance,
      buyerId === null
        ? 'Connect a wallet to check the buyer balance'
        : plan !== null && buyerFtBalance !== null
          ? `${buyerFtBalance} vs price ${plan.price}`
          : `FT balance unreadable (${symbol ?? '?'})`,
    ),
    gate(
      'buyer-ft-registered',
      buyerId ? 'Buyer registered with the FT' : 'Wallet connected (buyer FT registration)',
      buyerId !== null && buyerFtRegistered,
      buyerId === null ? 'Connect a wallet' : 'Buyer has no FT storage registration',
    ),
    gate(
      'buyer-storage',
      buyerId ? 'Buyer prepaid native storage (>= minimum)' : 'Wallet connected (buyer storage)',
      enoughStorage,
      buyerId === null
        ? 'Connect a wallet'
        : `prepaid ${buyerStorage ?? '?'} vs min ${storageMinimum ?? '?'} yoctoNEAR`,
    ),
  ];

  return {
    phase: 'ready',
    fetchedAtMs,
    block,
    info,
    ft,
    ftDeployed,
    ftDecimals: decimals,
    ftSymbol: symbol,
    plan,
    trader,
    storageMinimum,
    buyerStorage,
    buyerFtBalance,
    buyerFtRegistered,
    accessFtRegistered,
    gates,
    warnings,
  };
}