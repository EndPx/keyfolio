// TESTNET contract data layer (KF-08b) — READ-ONLY JSON-RPC views bound to a
// per-instance configuration. The server pages resolve the mode and pass the
// config down; client components never read server env directly. No key
// handling here: signing lives in the wallet selector action builders.

// The exact contract JSON is snake_case (see contracts/access/src/lib.rs:
// TraderStateJson, PlanJson, LicenseJson, TrancheJson, ContractInfo). Money is
// handled as canonical atomic strings with bigint arithmetic — never JS Number.

export interface TestnetClientConfig {
  rpcUrl: string;
  accessContract: string;
  /** Injectable transport for tests; defaults to the global fetch. */
  fetchFn?: TestnetFetch;
}

/** Narrow fetch shape the RPC layer uses (URL string + JSON() result). */
export interface TestnetFetch {
  (url: string, init?: RequestInit): Promise<{ json(): Promise<unknown> }>;
}

export type RpcEnvelope = { result?: unknown; error?: unknown };

// --- exact formatting helpers (bigint only, no float) ---------------------

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Canonical atomic string -> human decimal via bigint shift. No float. */
export function formatAtomic(atomic: string, decimals: number): string {
  if (decimals < 0) throw new Error('decimals must be >= 0');
  const value = BigInt(atomic);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}${frac && decimals > 0 ? `.${frac}` : ''}`;
}

/** yoctoNEAR -> NEAR via bigint shift (1 NEAR = 10^24 yocto). No float. */
export function formatYoctoNear(yocto: string): string {
  return formatAtomic(yocto, 24);
}

/** Normalize a contract u128 (returned as a string or a JS number) to a canonical string. */
export function normalizeAtomicU128(v: unknown): string {
  if (typeof v === 'string') {
    if (!/^(0|[1-9][0-9]*)$/.test(v)) throw new Error(`non-canonical U128 string: ${JSON.stringify(v)}`);
    return v;
  }
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) {
    return v.toString();
  }
  throw new Error(`unexpected U128 value: ${JSON.stringify(v)}`);
}

// --- JSON-RPC transport ---------------------------------------------------

async function rpc<T>(cfg: TestnetClientConfig, method: string, params: unknown): Promise<T> {
  const doFetch: TestnetFetch = cfg.fetchFn ?? ((url, init) => fetch(url, init));
  const res = await doFetch(cfg.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 'k', method, params }),
  });
  const j = (await res.json()) as RpcEnvelope;
  if (j.error) throw new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error));
  return j.result as T;
}

/** Finalized block context, for fetched-at/block freshness.
 *  `header.timestamp*` is the block time; `height`/`hash` identify the view. */
export interface BlockContext {
  height: number;
  hash: string;
  timestampNanos: string;
  timestampMs: number;
}

interface BlockResult {
  header: {
    height: number;
    hash: string;
    timestamp: number;
    timestamp_nanosec: string;
  };
}

export interface ContractCode {
  code_base64: string;
  hash: string;
}

export interface TestnetClient {
  cfg: TestnetClientConfig;
  accountExists(accountId: string): Promise<boolean>;
  viewBlock(): Promise<BlockContext>;
  viewCode(accountId: string): Promise<ContractCode>;
  /** Call a view on an explicit contract (defaults to `accessContract`). */
  callView<T>(methodName: string, args?: unknown, target?: string): Promise<T>;
  viewContractInfo(): Promise<ContractInfo>;
  viewCurrentPlan(traderId: string): Promise<PlanJson | null>;
  viewTrader(traderId: string): Promise<TraderJson | null>;
  viewLicense(tokenId: string): Promise<LicenseJson | null>;
  viewTokenTranches(tokenId: string): Promise<TrancheJson[]>;
  viewClaimable(traderId: string): Promise<string>;
  viewNftTokensForOwner(accountId: string): Promise<{ token_id: string; owner_id: string }[]>;
  viewHasPurchase(traderId: string, payer: string, purchaseId: string): Promise<boolean>;
  /** ACCESS prepaid native storage (yoctoNEAR) and minimum (yoctoNEAR). */
  viewStorageBalanceOf(accountId: string): Promise<string>;
  viewStorageMinimumBalance(): Promise<string>;
  /** FT (NEP-141/148) views, targeted at the FT contract explicitly. */
  viewFtMetadata(ftId: string): Promise<FtMetadata>;
  viewFtBalanceOf(ftId: string, accountId: string): Promise<string>;
  viewFtStorageBalanceOf(ftId: string, accountId: string): Promise<FtStorageBalance | null>;
}

// --- contract JSON types (exact snake_case, per lib.rs) -------------------

export interface ContractInfo {
  version: string;
  owner_id: string;
  monitor_id: string;
  ft_id: string;
}

export interface PlanJson {
  price: string;
  term_ms: number;
  active: boolean;
}

export interface TraderJson {
  sales_enabled: boolean;
  terminated: boolean;
  terminated_at_ms: number | null;
  current_plan_version: number;
}

export interface LicenseJson {
  token_id: string;
  owner_id: string;
  trader_id: string;
  issued_at_ms: number;
  expires_at_ms: number;
  plan_version: number;
  access_epoch: number;
  access_active: boolean;
}

export interface TrancheJson {
  tranche_id: string;
  start_ms: number;
  end_ms: number;
  gross: string;
  withdrawn: string;
  refunded: string;
}

/** NEP-148 metadata. `decimals`/`symbol` drive exact price display. */
export interface FtMetadata {
  spec: string;
  name: string;
  symbol: string;
  icon: string | null;
  reference: string | null;
  reference_hash: string | null;
  decimals: number;
}

/** NEP-145 storage balance; null means "not registered". */
export interface FtStorageBalance {
  total: string;
  available: string;
}

export function createTestnetClient(cfg: TestnetClientConfig): TestnetClient {
  const accountExists = async (accountId: string): Promise<boolean> => {
    try {
      await rpc(cfg, 'query', {
        request_type: 'view_account',
        finality: 'final',
        account_id: accountId,
      });
      return true;
    } catch {
      return false;
    }
  };

  const callView = async <T>(methodName: string, args?: unknown, target?: string): Promise<T> => {
    const raw = await rpc<{ result: number[] }>(cfg, 'query', {
      request_type: 'call_function',
      finality: 'final',
      account_id: target ?? cfg.accessContract,
      method_name: methodName,
      args_base64: toBase64(JSON.stringify(args ?? {})),
    });
    // Missing contract/method surfaces as an RPC error and must NOT be
    // swallowed as a quiet null; callers decide how to fail closed.
    if (!raw || !Array.isArray(raw.result)) {
      throw new Error(`view ${methodName} on ${target ?? cfg.accessContract}: malformed result`);
    }
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(raw.result))) as T;
  };

  const viewBlock = async (): Promise<BlockContext> => {
    const raw = await rpc<BlockResult>(cfg, 'block', { finality: 'final' });
    return {
      height: raw.header.height,
      hash: raw.header.hash,
      timestampNanos: raw.header.timestamp_nanosec,
      timestampMs: raw.header.timestamp * 1000,
    };
  };

  const viewCode = async (accountId: string): Promise<ContractCode> =>
    rpc<ContractCode>(cfg, 'query', {
      request_type: 'view_code',
      finality: 'final',
      account_id: accountId,
    });

  return {
    cfg,
    accountExists,
    callView,
    viewBlock,
    viewCode,
    viewContractInfo: () => callView<ContractInfo>('contract_info'),
    viewCurrentPlan: (traderId) => callView<PlanJson | null>('get_current_plan', { trader_id: traderId }),
    viewTrader: (traderId) => callView<TraderJson | null>('get_trader', { trader_id: traderId }),
    viewLicense: (tokenId) => callView<LicenseJson | null>('get_license', { token_id: tokenId }),
    viewTokenTranches: (tokenId) => callView<TrancheJson[]>('get_token_tranches', { token_id: tokenId }),
    viewClaimable: (traderId) => callView<string>('claimable_of', { trader_id: traderId }),
    viewNftTokensForOwner: (accountId) =>
      callView<{ token_id: string; owner_id: string }[]>('nft_tokens_for_owner', {
        account_id: accountId,
        from_index: null,
        limit: 50,
      }),
    viewHasPurchase: (traderId, payer, purchaseId) =>
      callView<boolean>('has_purchase', {
        trader_id: traderId,
        payer,
        purchase_id: purchaseId,
      }),
    viewStorageBalanceOf: (accountId) => callView<string>('storage_balance_of', { account_id: accountId }),
    viewStorageMinimumBalance: () => callView<string>('storage_minimum_balance'),
    // FT views target the FT contract explicitly (not ACCESS).
    viewFtMetadata: (ftId) => callView<FtMetadata>('ft_metadata', {}, ftId),
    viewFtBalanceOf: (ftId, accountId) => callView<string>('ft_balance_of', { account_id: accountId }, ftId),
    viewFtStorageBalanceOf: (ftId, accountId) =>
      callView<FtStorageBalance | null>('storage_balance_of', { account_id: accountId }, ftId),
  };
}

/** Default TESTNET client. The RPC URL is client-visible (public read-only). */
export const testnetClient = createTestnetClient({
  rpcUrl: process.env.NEXT_PUBLIC_NEAR_RPC_URL ?? 'https://rpc.testnet.near.org',
  accessContract: process.env.NEXT_PUBLIC_ACCESS_CONTRACT_ID ?? 'keyfolio-access.testnet',
});