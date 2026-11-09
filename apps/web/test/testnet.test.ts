// Read-only client tests: exact snake_case contract mapping, explicit FT
// query target, blocking metadata failure (no fallback), and bigint-exact
// formatting. No wallet, no signing, no network — the fetch transport is
// faked with synthetic RPC envelopes.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTestnetClient, formatAtomic, formatYoctoNear, normalizeAtomicU128 } from '../src/testnet';

const ACCESS = 'access.near';
const FT = 'ft.near';

function bytesOf(value: unknown): number[] {
  return Array.from(new TextEncoder().encode(JSON.stringify(value)));
}

function viewResult(value: unknown) {
  return { result: bytesOf(value), block_height: 100, block_hash: 'Hhh' };
}

type Call = { method: string; params: Record<string, unknown> };

function fakeFetch(handler: (call: Call) => unknown): (url: string, init?: RequestInit) => Promise<{ json(): Promise<unknown> }> {
  return async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { method: string; params: Record<string, unknown> };
    const out = handler({ method: body.method, params: body.params });
    // Normalize to a JSON-RPC envelope: success wraps `out` as the RPC result,
    // while `{ error }` is passed through as the envelope error.
    const envelope =
      out && typeof out === 'object' && 'error' in out
        ? out
        : { id: 'k', jsonrpc: '2.0', result: out };
    return { json: async () => envelope };
  };
}

test('get_trader maps the exact snake_case contract JSON (no camelCase alias)', async () => {
  const calls: Array<{ method: string; account_id: string }> = [];
  const client = createTestnetClient({
    rpcUrl: 'https://synthetic.example',
    accessContract: ACCESS,
    fetchFn: fakeFetch((call) => {
      calls.push({
        method: (call.params.request_type === 'call_function' ? call.params.method_name : call.params.request_type) as string,
        account_id: (call.params.account_id as string) ?? '',
      });
      return viewResult({
        sales_enabled: true,
        terminated: false,
        terminated_at_ms: null,
        current_plan_version: 3,
      });
    }),
  });

  const trader = await client.viewTrader('ops.near');
  assert.equal(trader?.sales_enabled, true);
  assert.equal(trader?.terminated, false);
  assert.equal(trader?.terminated_at_ms, null);
  assert.equal(trader?.current_plan_version, 3);
  // There is no camelCase field in the contract; the reader must expose snake_case.
  assert.equal(Object.prototype.hasOwnProperty.call(trader, 'salesEnabled'), false);
});

test('ft_metadata is queried on the FT contract, not the ACCESS contract', async () => {
  const accounts: string[] = [];
  const client = createTestnetClient({
    rpcUrl: 'https://synthetic.example',
    accessContract: ACCESS,
    fetchFn: fakeFetch((call) => {
      if (call.params.request_type === 'call_function') {
        accounts.push(call.params.account_id as string);
        return viewResult({ spec: 'ft-1.0.0', name: 'T', symbol: 'TKN', icon: null, reference: null, reference_hash: null, decimals: 8 });
      }
      return viewResult({});
    }),
  });
  const meta = await client.viewFtMetadata(FT);
  assert.equal(meta.decimals, 8);
  assert.equal(meta.symbol, 'TKN');
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0], FT, 'ft_metadata must target the FT account, not ACCESS');
});

test('metadata failure is a thrown error (blocking), never a silent null', async () => {
  const client = createTestnetClient({
    rpcUrl: 'https://synthetic.example',
    accessContract: ACCESS,
    fetchFn: fakeFetch(() => ({ error: { message: 'wasm execution failed' } })),
  });
  await assert.rejects(() => client.viewFtMetadata(FT), /wasm execution failed/);
});

test('callView defaults to the ACCESS contract for contract views', async () => {
  const accounts: string[] = [];
  const client = createTestnetClient({
    rpcUrl: 'https://synthetic.example',
    accessContract: ACCESS,
    fetchFn: fakeFetch((call) => {
      if (call.params.request_type === 'call_function') {
        accounts.push(call.params.account_id as string);
        return viewResult({ version: 'kf', owner_id: 'o', monitor_id: 'm', ft_id: FT });
      }
      return viewResult({});
    }),
  });
  await client.viewContractInfo();
  assert.equal(accounts[0], ACCESS);
});

test('exact bigint formatting: atomic -> human and yoctoNEAR -> NEAR (no float)', () => {
  assert.equal(formatAtomic('25000000', 6), '25');
  assert.equal(formatAtomic('100', 3), '0.1');
  assert.equal(formatAtomic('1', 3), '0.001');
  assert.equal(formatAtomic('5', 0), '5');
  assert.equal(formatAtomic('123456789', 6), '123.456789');
  assert.equal(formatYoctoNear('1000000000000000000000000'), '1');
  assert.equal(formatYoctoNear('5000000000000000000000'), '0.005');
});

test('normalizeAtomicU128 accepts canonical strings and safe integers, rejects garbage', () => {
  assert.equal(normalizeAtomicU128('0'), '0');
  assert.equal(normalizeAtomicU128('101'), '101');
  assert.equal(normalizeAtomicU128(0), '0');
  assert.equal(normalizeAtomicU128(101), '101');
  assert.throws(() => normalizeAtomicU128('1.5'));
  assert.throws(() => normalizeAtomicU128('01'));
  assert.throws(() => normalizeAtomicU128('-1'));
  assert.throws(() => normalizeAtomicU128('1e3'));
  assert.throws(() => normalizeAtomicU128(1.5));
});