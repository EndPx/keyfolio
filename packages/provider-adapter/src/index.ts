import type { KeyfolioMode } from '@keyfolio/domain';

export type Capability = 'authenticate' | 'identity' | 'balances' | 'activity' | 'execution_status' | 'revoke_or_disconnect';
export type CapabilityState = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN' | 'BLOCKED_EXTERNAL';

export interface CapabilityFlags { readonly [capability: string]: CapabilityState; }
export interface SourceTime { occurred_at: string | null; executed_at: string | null; confirmed_at: string | null; observed_at: string; trust: 'trusted' | 'untrusted' | 'missing'; reason: string; }
export interface Provenance { provider: string; source: string; source_reference: string | null; source_time: SourceTime; }
export interface ProviderContext { readonly mode: KeyfolioMode; readonly network: 'mainnet' | 'testnet'; readonly capabilities: CapabilityFlags; }
export interface ProviderAuthRequest { account: string; authorization: string; }
export interface ProviderAuthResult { connection_reference: string; account: string; expires_at: string | null; provenance: Provenance; }
export interface ProviderIdentity { account: string; provider_account_id: string; display_name: string | null; provenance: Provenance; }
export interface ProviderBalance { asset_id: string; atomic_amount: string; provenance: Provenance; }
export interface ProviderActivity { source_event_id: string; status: 'pending' | 'confirmed' | 'failed' | 'refunded'; asset_id: string; atomic_amount: string; provenance: Provenance; }
export interface ActivityPage { items: ProviderActivity[]; next_cursor: string | null; provenance: Provenance; }
export interface ExecutionStatus { reference: string; status: 'unknown' | 'pending' | 'confirmed' | 'failed'; provenance: Provenance; }

export interface ProviderAdapter {
  readonly context: ProviderContext;
  authenticate(request: ProviderAuthRequest): Promise<ProviderAuthResult>;
  getIdentity(connectionReference: string): Promise<ProviderIdentity>;
  getBalances(connectionReference: string): Promise<ProviderBalance[]>;
  listActivity(connectionReference: string, cursor?: string): Promise<ActivityPage>;
  getExecutionStatus(connectionReference: string, reference: string): Promise<ExecutionStatus>;
  revokeOrDisconnect(connectionReference: string): Promise<void>;
}

export class ProviderCapabilityError extends Error {
  readonly code = 'provider_capability_unavailable';
  constructor(message: string, readonly capability: Capability, readonly mode: KeyfolioMode) { super(message); this.name = 'ProviderCapabilityError'; }
}

function fixtureProvenance(observedAt: string): Provenance {
  return { provider: 'synthetic-fixture', source: 'FIXTURE_ONLY', source_reference: null, source_time: { occurred_at: observedAt, executed_at: observedAt, confirmed_at: observedAt, observed_at: observedAt, trust: 'trusted', reason: 'synthetic fixture timestamp; not upstream evidence' } };
}

export function createFixtureAdapter(mode: KeyfolioMode, now: () => string = () => new Date().toISOString()): ProviderAdapter {
  if (mode !== 'FIXTURE') throw new ProviderCapabilityError('synthetic provider adapter is disabled outside FIXTURE mode', 'authenticate', mode);
  const context: ProviderContext = { mode, network: 'testnet', capabilities: { authenticate: 'SUPPORTED', identity: 'SUPPORTED', balances: 'SUPPORTED', activity: 'SUPPORTED', execution_status: 'SUPPORTED', revoke_or_disconnect: 'SUPPORTED' } };
  const connections = new Set<string>();
  const adapter: ProviderAdapter = {
    context,
    async authenticate(request) { const observed = now(); const reference = `fixture:${request.account}`; connections.add(reference); return { connection_reference: reference, account: request.account, expires_at: null, provenance: fixtureProvenance(observed) }; },
    async getIdentity(reference) { ensure(reference, connections); const observed = now(); return { account: reference.slice('fixture:'.length), provider_account_id: reference, display_name: null, provenance: fixtureProvenance(observed) }; },
    async getBalances(reference) { ensure(reference, connections); const observed = now(); return [{ asset_id: 'fixture.usdc', atomic_amount: '0', provenance: fixtureProvenance(observed) }]; },
    async listActivity(reference, cursor) { ensure(reference, connections); const observed = now(); return { items: [], next_cursor: cursor ? null : null, provenance: fixtureProvenance(observed) }; },
    async getExecutionStatus(reference, executionReference) { ensure(reference, connections); const observed = now(); return { reference: executionReference, status: 'unknown', provenance: fixtureProvenance(observed) }; },
    async revokeOrDisconnect(reference) { ensure(reference, connections); connections.delete(reference); },
  };
  return adapter;
}

function ensure(reference: string, connections: Set<string>): void { if (!connections.has(reference)) throw new ProviderCapabilityError('unknown fixture connection', 'identity', 'FIXTURE'); }

/** No upstream route is guessed here: real adapters must be added only after capability evidence. */
export function createProviderAdapter(mode: KeyfolioMode): ProviderAdapter {
  if (mode === 'FIXTURE') return createFixtureAdapter(mode);
  throw new ProviderCapabilityError('no TESTNET/LIVE provider adapter is configured; upstream capability is BLOCKED_EXTERNAL', 'authenticate', mode);
}
