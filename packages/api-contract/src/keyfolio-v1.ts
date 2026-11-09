import type { Envelope, Meta } from './envelope.js';
import type { AtomicAmount } from './validate.js';

export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX = 100;
export type OpaqueCursor = string;

export interface Page<T> {
  items: T[];
  next_cursor: OpaqueCursor | null;
  limit: number;
}

export interface PublicTrader { id: string; display_name: string; handle: string; network: 'mainnet' | 'testnet'; }
export interface PublicPerformance { trader_id: string; period: { start: string; end: string }; pnl_atomic: AtomicAmount | null; return_bps: string | null; drawdown_bps: string | null; coverage: string; }
export interface AuthChallenge { challenge_id: string; nonce: string; domain: string; network: 'mainnet' | 'testnet'; account: string; intent: 'keyfolio_login'; issued_at: string; expires_at: string; }
export interface AuthSession { session_expires_at: string; account: string; network: 'mainnet' | 'testnet'; }
export interface Connection { id: string; network: 'mainnet' | 'testnet'; account: string; status: 'pending' | 'connected' | 'reauth_required' | 'disconnected'; source_time: string | null; provenance: string; }
export interface License { id: string; trader_id: string; owner: string; network: 'mainnet' | 'testnet'; contract_id: string; token_id: string; expires_at: string; epoch: string; status: 'active' | 'expired' | 'pending_transfer' | 'disabled'; }
export interface ApiCredential { id: string; license_id: string; scopes: string[]; expires_at: string; quota_per_minute: number; secret: string | null; }
export interface Activity { id: string; trader_id: string; occurred_at: string; source_execution_at: string | null; source_time_trust: 'trusted' | 'untrusted' | 'missing'; status: 'pending' | 'confirmed' | 'failed' | 'refunded' | 'quarantined'; asset_id: string; atomic_amount: AtomicAmount; provenance: string; }
export interface Position { asset_id: string; atomic_amount: AtomicAmount; source_snapshot_at: string; provenance: string; }
export interface CopyQuote { quote_id: string; source_activity_id: string; input_asset: string; output_asset: string; input_atomic_amount: AtomicAmount; minimum_received_atomic: AtomicAmount; fee_atomic: AtomicAmount; deadline: string; recipient: string; refund_destination: string; }
export interface CopyOrder { id: string; quote_id: string; state: 'CREATED' | 'QUOTED' | 'AWAITING_USER' | 'SUBMITTED' | 'SETTLED' | 'REFUNDED' | 'FAILED' | 'EXPIRED' | 'UNKNOWN'; execution_reference: string | null; }

export interface ListQuery { cursor?: OpaqueCursor; limit?: number; }
export interface AuthChallengeRequest { network: 'mainnet' | 'testnet'; account: string; domain: string; }
export interface AuthVerifyRequest { challenge_id: string; signature: string; }
export interface ConnectionRequest { network: 'mainnet' | 'testnet'; account: string; consent_version: string; }
export interface CredentialRequest { license_id: string; scopes: string[]; }
export interface CopyQuoteRequest { license_id: string; source_activity_id: string; input_asset: string; input_atomic_amount: AtomicAmount; slippage_bps: string; recipient: string; refund_destination: string; }
export interface CopyOrderRequest { quote_id: string; idempotency_key: string; }

export type PublicBoundary<T> = { visibility: 'public'; data: T };
export type PrivateBoundary<T> = { visibility: 'private'; data: T; license_id: string };
export type EntitlementBoundary<T> = { visibility: 'entitled'; data: T; license_id: string; epoch: string };

export type Section11Route = {
  method: 'GET' | 'POST' | 'DELETE'; path: string; auth: 'public' | 'session' | 'trader' | 'credential' | 'entitled' | 'follower'; response: string; statuses: Record<number, string>;
};

export const SECTION_11_ROUTES: readonly Section11Route[] = [
  { method: 'GET', path: '/v1/traders', auth: 'public', response: 'Page<PublicTrader>', statuses: { 200: 'success', 422: 'invalid_parameters', 503: 'upstream_unavailable' } },
  { method: 'GET', path: '/v1/traders/:id/performance', auth: 'public', response: 'PublicPerformance', statuses: { 200: 'success', 404: 'not_found', 422: 'invalid_parameters', 503: 'upstream_unavailable' } },
  { method: 'POST', path: '/v1/auth/challenge', auth: 'public', response: 'AuthChallenge', statuses: { 200: 'success', 422: 'invalid_parameters', 429: 'rate_limited' } },
  { method: 'POST', path: '/v1/auth/verify', auth: 'public', response: 'AuthSession', statuses: { 200: 'success', 401: 'invalid_authentication', 409: 'stale_state', 422: 'invalid_parameters', 429: 'rate_limited' } },
  { method: 'POST', path: '/v1/trader/connections', auth: 'trader', response: 'Connection', statuses: { 201: 'success', 401: 'invalid_authentication', 403: 'scope_denied', 409: 'stale_state', 422: 'invalid_parameters', 503: 'upstream_unavailable' } },
  { method: 'DELETE', path: '/v1/trader/connections/:id', auth: 'trader', response: 'Connection', statuses: { 200: 'success', 401: 'invalid_authentication', 403: 'scope_denied', 404: 'not_found', 409: 'stale_state' } },
  { method: 'GET', path: '/v1/me/licenses', auth: 'session', response: 'Page<License>', statuses: { 200: 'success', 401: 'invalid_authentication', 503: 'authorization_freshness_unavailable' } },
  { method: 'POST', path: '/v1/me/api-credentials', auth: 'session', response: 'ApiCredential', statuses: { 201: 'success', 401: 'invalid_authentication', 403: 'entitlement_required', 409: 'stale_state', 422: 'invalid_parameters', 429: 'quota_exceeded' } },
  { method: 'DELETE', path: '/v1/me/api-credentials/:id', auth: 'session', response: 'ApiCredential', statuses: { 200: 'success', 401: 'invalid_authentication', 404: 'not_found' } },
  { method: 'GET', path: '/v1/traders/:id/activity', auth: 'entitled', response: 'Page<Activity>', statuses: { 200: 'success', 401: 'invalid_authentication', 403: 'entitlement_required', 409: 'stale_state', 422: 'invalid_parameters', 429: 'quota_exceeded', 503: 'authorization_freshness_unavailable' } },
  { method: 'GET', path: '/v1/traders/:id/positions', auth: 'entitled', response: 'Page<Position>', statuses: { 200: 'success', 401: 'invalid_authentication', 403: 'entitlement_required', 409: 'stale_state', 503: 'authorization_freshness_unavailable' } },
  { method: 'POST', path: '/v1/copy-quotes', auth: 'follower', response: 'CopyQuote', statuses: { 201: 'success', 401: 'invalid_authentication', 403: 'entitlement_required', 409: 'stale_state', 422: 'invalid_parameters', 429: 'quota_exceeded', 503: 'upstream_unavailable' } },
  { method: 'POST', path: '/v1/copy-orders', auth: 'follower', response: 'CopyOrder', statuses: { 201: 'success', 401: 'invalid_authentication', 403: 'entitlement_required', 409: 'stale_state', 422: 'invalid_parameters' } },
  { method: 'GET', path: '/v1/copy-orders/:id', auth: 'follower', response: 'CopyOrder', statuses: { 200: 'success', 401: 'invalid_authentication', 403: 'scope_denied', 404: 'not_found', 503: 'upstream_unavailable' } },
] as const;

export const ERROR_STATUS: Readonly<Record<string, number>> = { invalid_authentication: 401, entitlement_required: 403, scope_denied: 403, not_found: 404, stale_state: 409, invalid_parameters: 422, quota_exceeded: 429, rate_limited: 429, upstream_unavailable: 503, authorization_freshness_unavailable: 503 };

export function isValidPageLimit(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= PAGE_LIMIT_MAX; }
export function validateListQuery(query: unknown): { ok: true; value: ListQuery } | { ok: false; code: 'invalid_parameters'; reason: string } {
  if (!query || typeof query !== 'object' || Array.isArray(query)) return { ok: false, code: 'invalid_parameters', reason: 'query must be an object' };
  const q = query as Record<string, unknown>;
  if (q.cursor !== undefined && (typeof q.cursor !== 'string' || q.cursor.length === 0 || q.cursor.length > 512)) return { ok: false, code: 'invalid_parameters', reason: 'cursor must be a nonempty opaque string of at most 512 characters' };
  if (q.limit !== undefined && !isValidPageLimit(q.limit)) return { ok: false, code: 'invalid_parameters', reason: `limit must be an integer between 1 and ${PAGE_LIMIT_MAX}` };
  return { ok: true, value: { cursor: q.cursor as string | undefined, limit: (q.limit as number | undefined) ?? PAGE_LIMIT_DEFAULT } };
}

export type Section11Envelope<T> = Envelope<T>;
export type Section11Meta = Meta;
