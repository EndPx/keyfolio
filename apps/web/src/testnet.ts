'use client';

/**
 * TESTNET contract data layer (KF-08b.2/3) — read-only JSON-RPC views bound
 * to a per-instance configuration. The server pages resolve the mode and
 * pass the config down; client components never read server env directly.
 * No key handling here: signing lives in the wallet selector.
 */

export interface TestnetClientConfig {
  rpcUrl: string;
  accessContract: string;
}

export type RpcEnvelope = { result?: unknown; error?: unknown };

async function rpc<T>(cfg: TestnetClientConfig, method: string, params: unknown): Promise<T> {
  const res = await fetch(cfg.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'k', method, params }),
  });
  const j = (await res.json()) as RpcEnvelope;
  if (j.error) throw new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error));
  return j.result as T;
}

export interface TestnetClient {
  cfg: TestnetClientConfig;
  accountExists(accountId: string): Promise<boolean>;
  callView<T>(methodName: string, args?: unknown): Promise<T>;
  viewContractInfo(): Promise<ContractInfo>;
  viewCurrentPlan(traderId: string): Promise<PlanJson | null>;
  viewTrader(traderId: string): Promise<TraderJson | null>;
  viewLicense(tokenId: string): Promise<LicenseJson | null>;
  viewTokenTranches(tokenId: string): Promise<TrancheJson[]>;
  viewClaimable(traderId: string): Promise<string>;
  viewNftTokensForOwner(accountId: string): Promise<{ token_id: string; owner_id: string }[]>;
  /** FT metadata (decimals) for exact price display; null when FT absent. */
  viewFtMetadata(ftId: string): Promise<{ decimals: number } | null>;
}

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
  salesEnabled: boolean;
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
  const callView = async <T>(methodName: string, args?: unknown): Promise<T> => {
    const raw = await rpc<{ result: number[] }>(cfg, 'query', {
      request_type: 'call_function',
      finality: 'final',
      account_id: cfg.accessContract,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args ?? {})).toString('base64'),
    });
    return JSON.parse(Buffer.from(raw.result).toString()) as T;
  };
  return {
    cfg,
    accountExists,
    callView,
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
    viewFtMetadata: async (ftId) => {
      try {
        return await callView<{ decimals: number }>(ftId, 'ft_metadata');
      } catch {
        return null; // FT not deployed or not an FT: callers treat as absent
      }
    },
  };
}

/** Default TESTNET client (the deployed KF-05 contract). */
export const testnetClient = createTestnetClient({
  rpcUrl: 'https://rpc.testnet.near.org',
  accessContract: process.env.NEXT_PUBLIC_ACCESS_CONTRACT_ID ?? 'keyfolio-access.testnet',
});
