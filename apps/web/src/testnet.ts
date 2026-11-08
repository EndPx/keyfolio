'use client';

/**
 * TESTNET contract data layer — real view calls against the deployed access
 * contract (keyfolio-access.testnet). Plain JSON-RPC over fetch: no SDK
 * version coupling for read-only queries. Every function throws on contract
 * errors; callers own the loading/error states.
 */

export const NETWORK = 'testnet';
export const RPC_URL = 'https://rpc.testnet.near.org';
/** The deployed access contract (KF-05b/c evidence: tx 2BC64VGh…). */
export const ACCESS_CONTRACT =
  process.env.NEXT_PUBLIC_ACCESS_CONTRACT_ID ?? 'keyfolio-access.testnet';
/** The demo trader whose plan was published on testnet (operator account). */
export const DEMO_TRADER =
  process.env.NEXT_PUBLIC_DEMO_TRADER_ID ?? 'keyfolio-ops.testnet';

type RpcResult<T> = { result?: T; error?: unknown };

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'k', method, params }),
  });
  const j = (await res.json()) as RpcResult<T>;
  if (j.error) throw new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error));
  return j.result as T;
}

export async function accountExists(accountId: string): Promise<boolean> {
  try {
    await rpc('query', { request_type: 'view_account', finality: 'final', account_id: accountId });
    return true;
  } catch {
    return false;
  }
}

export async function callView<T>(contractId: string, methodName: string, args?: unknown): Promise<T> {
  const raw = await rpc<{ result: number[]; logs?: string[] }>('query', {
    request_type: 'call_function',
    finality: 'final',
    account_id: contractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args ?? {})).toString('base64'),
  });
  return JSON.parse(Buffer.from(raw.result).toString()) as T;
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

export const viewTrader = (traderId: string) =>
  callView<{ salesEnabled: boolean; terminated: boolean; terminated_at_ms: number | null; current_plan_version: number } | null>(ACCESS_CONTRACT, 'get_trader', { trader_id: traderId });
export const viewContractInfo = () => callView<ContractInfo>(ACCESS_CONTRACT, 'contract_info');
export const viewCurrentPlan = (traderId: string) =>
  callView<PlanJson | null>(ACCESS_CONTRACT, 'get_current_plan', { trader_id: traderId });
export const viewLicense = (tokenId: string) =>
  callView<LicenseJson | null>(ACCESS_CONTRACT, 'get_license', { token_id: tokenId });
export const viewTokenTranches = (tokenId: string) =>
  callView<TrancheJson[]>(ACCESS_CONTRACT, 'get_token_tranches', { token_id: tokenId });
export const viewClaimable = (traderId: string) =>
  callView<string>(ACCESS_CONTRACT, 'claimable_of', { trader_id: traderId });
export const viewNftTokensForOwner = (accountId: string) =>
  callView<{ token_id: string; owner_id: string }[]>(ACCESS_CONTRACT, 'nft_tokens_for_owner', {
    account_id: accountId,
    from_index: null,
    limit: 50,
  });
