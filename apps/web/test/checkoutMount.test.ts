// Mount decision: TESTNET mounts the read-only checkout, FIXTURE serves the
// demo, LIVE (and anything else) mounts nothing testnet — fail closed.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkoutMount } from '../src/checkoutMount';

test('checkoutMount maps modes to fixture/testnet/none', () => {
  assert.equal(checkoutMount('TESTNET'), 'testnet');
  assert.equal(checkoutMount('FIXTURE'), 'fixture');
  assert.equal(checkoutMount('LIVE'), 'none', 'LIVE must never mount the testnet checkout');
});