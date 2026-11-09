// Preflight tests: blocking gates for missing metadata / storage / stale
// reads, and the fetched-at/block freshness rule. The RPC transport is fake —
// no network, no signing, no transactions.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canPurchase,
  isPreflightStale,
  runCheckoutPreflight,
  type PreflightReady,
} from '../src/preflight';

const ACCESS = 'access.near';
const FT = 'ft.near';
const BUYER = 'buyer.near';
const TRADER = 'ops.near';

function bytesOf(value: unknown): number[] {
  return Array.from(new TextEncoder().encode(JSON.stringify(value)));
}

/** Decode the args_base64 the client sends so the fake can route by arg. */
function decodeArgs(params: Record<string, unknown>): Record<string, unknown> {
  const b64 = params.args_base64 as string;
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
}

function viewResult(value: unknown) {
  return { result: bytesOf(value), block_height: 1, block_hash: 'H' };
}

type Query = { method: string; params: Record<string, unknown> };

function fakeFetch(handler: (q: Query) => unknown): (url: string, init?: RequestInit) => Promise<{ json(): Promise<unknown> }> {
  return async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as Query;
    const out = handler(body);
    const envelope =
      out && typeof out === 'object' && 'error' in out
        ? out
        : { id: 'k', jsonrpc: '2.0', result: out };
    return { json: async () => envelope };
  };
}

/** A full happy-path dispatcher; `overrides` may force an error per method name
 *  (or for the top-level `block` RPC method via `block`). */
function happyFetch(overrides: Record<string, unknown> = {}, accountOverrides: Record<string, unknown> = {}) {
  return fakeFetch((q) => {
    if (q.method === 'block') {
      if (overrides['block'] !== undefined) {
        return { error: { message: overrides['block'] } };
      }
      return { header: { height: 421, hash: 'BH', timestamp: 1700000000, timestamp_nanosec: '1700000000000000000' } };
    }
    const p = q.params;
    if (p.request_type === 'view_code') {
      return { code_base64: 'QUJD', hash: 'codehash' };
    }
    if (p.request_type === 'call_function') {
      const methodName = p.method_name as string;
      const account = p.account_id as string;
      if (overrides[methodName] !== undefined) {
        return { error: { message: overrides[methodName] } };
      }
      if (methodName === 'contract_info') {
        return viewResult({ version: 'kf', owner_id: 'owner.near', monitor_id: 'mon.near', ft_id: FT });
      }
      if (methodName === 'get_trader') {
        return viewResult({ sales_enabled: true, terminated: false, terminated_at_ms: null, current_plan_version: 1 });
      }
      if (methodName === 'get_current_plan') {
        return viewResult({ price: '25000000', term_ms: 2592000, active: true });
      }
      if (methodName === 'ft_metadata') {
        return viewResult({ spec: 'ft-1.0.0', name: 'Token', symbol: 'TKN', icon: null, reference: null, reference_hash: null, decimals: 6 });
      }
      if (methodName === 'ft_balance_of') {
        return viewResult('30000000');
      }
      if (methodName === 'storage_balance_of') {
        // Distinguish FT receiver registration vs ACCESS prepaid native storage.
        const target = decodeArgs(p).account_id as string;
        if (account === FT) {
          return viewResult({ total: '1', available: '1' }); // FT storage (registered)
        }
        // ACCESS prepaid native storage for `target`
        const override = accountOverrides[`access:${target}`];
        if (override !== undefined) return viewResult(String(override));
        return viewResult(target === BUYER ? '200' : '0');
      }
      if (methodName === 'storage_minimum_balance') {
        return viewResult('100');
      }
    }
    return viewResult({});
  });
}

function makeReady(overrides: Partial<PreflightReady>): PreflightReady {
  return {
    phase: 'ready',
    fetchedAtMs: Date.now(),
    block: { height: 1, hash: 'H', timestampNanos: '1', timestampMs: 1 },
    info: { version: 'kf', owner_id: 'o', monitor_id: 'm', ft_id: FT },
    ft: { spec: 'ft-1.0.0', name: 'T', symbol: 'TKN', icon: null, reference: null, reference_hash: null, decimals: 6 },
    ftDeployed: true,
    ftDecimals: 6,
    ftSymbol: 'TKN',
    plan: { price: '25000000', term_ms: 2592000, active: true },
    trader: { sales_enabled: true, terminated: false, terminated_at_ms: null, current_plan_version: 1 },
    storageMinimum: '100',
    buyerStorage: '200',
    buyerFtBalance: '30000000',
    buyerFtRegistered: true,
    accessFtRegistered: true,
    gates: [],
    warnings: [],
    ...overrides,
  };
}

test('happy path: all first-buyer gates pass and purchase is enabled while fresh', async () => {
  const result = await runCheckoutPreflight(
    { rpcUrl: 'https://synthetic.example', accessContract: ACCESS, fetchFn: happyFetch() },
    TRADER,
    BUYER,
  );
  assert.equal(result.phase, 'ready');
  if (result.phase !== 'ready') return;
  assert.equal(result.ftDecimals, 6);
  assert.equal(result.ftSymbol, 'TKN');
  assert.ok(result.gates.every((g) => g.ok), `all gates should pass, blocked: ${result.gates.filter((g) => !g.ok).map((g) => g.id).join(',')}`);
  assert.equal(canPurchase(result), true);
});

test('metadata failure is a BLOCKING gate: no decimals fallback, purchase disabled', async () => {
  const result = await runCheckoutPreflight(
    { rpcUrl: 'https://synthetic.example', accessContract: ACCESS, fetchFn: happyFetch({ ft_metadata: 'no metadata' }) },
    TRADER,
    BUYER,
  );
  assert.equal(result.phase, 'ready');
  if (result.phase !== 'ready') return;
  assert.equal(result.ft, null);
  assert.equal(result.ftDecimals, null);
  assert.equal(result.gates.find((g) => g.id === 'ft-metadata')?.ok, false);
  assert.equal(canPurchase(result), false);
});

test('missing prepaid storage blocks purchase (native storage kept separate from price)', async () => {
  const result = await runCheckoutPreflight(
    { rpcUrl: 'https://synthetic.example', accessContract: ACCESS, fetchFn: happyFetch({}, { [`access:${BUYER}`]: '5' }) },
    TRADER,
    BUYER,
  );
  assert.equal(result.phase, 'ready');
  if (result.phase !== 'ready') return;
  assert.equal(result.gates.find((g) => g.id === 'buyer-storage')?.ok, false);
  assert.equal(canPurchase(result), false);
});

test('missing block context is a BLOCKING gate (unreadable finality disables purchase)', async () => {
  const result = await runCheckoutPreflight(
    { rpcUrl: 'https://synthetic.example', accessContract: ACCESS, fetchFn: happyFetch({ block: 'RPC unavailable' }) },
    TRADER,
    BUYER,
  );
  assert.equal(result.phase, 'ready');
  if (result.phase !== 'ready') return;
  assert.equal(result.block, null);
  assert.equal(result.gates.find((g) => g.id === 'block-context')?.ok, false);
  assert.equal(canPurchase(result), false);
});

test('an invalid RPC (contract_info error) fails the preflight closed', async () => {
  const result = await runCheckoutPreflight(
    {
      rpcUrl: 'https://synthetic.example',
      accessContract: ACCESS,
      fetchFn: fakeFetch((q) =>
        q.params.request_type === 'call_function' && q.params.method_name === 'contract_info'
          ? { error: { message: 'UNKNOWN_ACCOUNT' } }
          : viewResult({}),
      ),
    },
    TRADER,
    BUYER,
  );
  assert.equal(result.phase, 'error');
});

test('stale preflight (>30s) and blocked gates never enable purchase', () => {
  const blocked = makeReady({ gates: [{ id: 'buyer-storage', label: 'x', ok: false }] });
  assert.equal(canPurchase(blocked), false);

  const stale = makeReady({ fetchedAtMs: Date.now() - 31_000 });
  stale.gates = [{ id: 'x', label: 'x', ok: true }];
  assert.equal(isPreflightStale(stale), true);
  assert.equal(canPurchase(stale), false);
});