import { test } from 'node:test';
import assert from 'node:assert/strict';

import { failure, isSuccessEnvelope, success } from '../src/envelope.js';
import { validateAmountRequest } from '../src/validate.js';

const META = { request_id: 'r1', observed_at: '2026-11-06T00:00:00.000Z', coverage: 'none', stale: false };

test('envelope shape: data/meta/error', () => {
  const ok = success({ valid: true }, META);
  assert.deepEqual(ok, { data: { valid: true }, meta: META, error: null });
  assert.equal(isSuccessEnvelope(ok), true);

  const err = failure(META, 'invalid_amount', 'nope', false);
  assert.deepEqual(err, {
    data: null,
    meta: META,
    error: { code: 'invalid_amount', message: 'nope', retryable: false },
  });
  assert.equal(isSuccessEnvelope(err), false);
});

test('validateAmountRequest accepts canonical string amounts', () => {
  assert.deepEqual(validateAmountRequest({ amount: '0' }), { valid: true, amount: '0', network: null });
  assert.deepEqual(
    validateAmountRequest({ amount: '340282366920938463463374607431768211455' }),
    { valid: true, amount: '340282366920938463463374607431768211455', network: null },
  );
  assert.deepEqual(validateAmountRequest({ amount: '5', network: 'mainnet' }), {
    valid: true,
    amount: '5',
    network: 'mainnet',
  });
});

test('validateAmountRequest rejects float, string fraction, overflow, unknown network', () => {
  const cases: Array<[unknown, string]> = [
    [{ amount: 1.5 }, 'invalid_amount'],
    [{ amount: '1.5' }, 'invalid_amount'],
    [{ amount: 1 }, 'invalid_amount'],
    [{ amount: '01' }, 'invalid_amount'],
    [{ amount: '-1' }, 'invalid_amount'],
    [{ amount: '340282366920938463463374607431768211456' }, 'invalid_amount'],
    [{ amount: '5', network: 'mysterynet' }, 'unknown_network'],
    [{}, 'invalid_amount'],
    [null, 'invalid_amount'],
    ['1.5', 'invalid_amount'],
  ];
  for (const [body, code] of cases) {
    const r = validateAmountRequest(body);
    assert.equal(r.valid, false, `expected rejection of ${JSON.stringify(body)}`);
    if (r.valid === false) assert.equal(r.code, code);
  }
});