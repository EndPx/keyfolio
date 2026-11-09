// Action builder tests: assert the EXACT Wallet Selector `Action` shape for
// purchase (ft_transfer_call) and withdraw (ft_withdraw) — method name, args
// bytes, gas and deposit. No wallet is called; these are the same
// `near-api-js` Action instances the selector `actions: Array<Action>` type
// accepts (no `as never` cast).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPurchaseActions, buildWithdrawActions, purchaseMessage } from '../src/nearActions';

function decodeArgs(action: { args: Uint8Array }): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(action.args)) as Record<string, unknown>;
}

test('purchase builds a NEP-141 ft_transfer_call Action with exact args/gas/deposit', () => {
  const msg = purchaseMessage({ traderId: 'ops.near', planVersion: 1, purchaseId: 'web-1' });
  const actions = buildPurchaseActions({ accessContract: 'access.near', amountAtomic: '25000000', msg });

  assert.equal(actions.length, 1);
  const fc = actions[0].functionCall;
  assert.ok(fc, 'Action must be a functionCall');
  assert.equal(fc.methodName, 'ft_transfer_call');
  assert.equal(fc.gas, 250n * 10n ** 12n);
  assert.equal(fc.deposit, 1n); // NEP-141 one-yocto requirement
  const args = decodeArgs(fc);
  assert.deepEqual(args, {
    receiver_id: 'access.near',
    amount: '25000000',
    memo: 'keyfolio access purchase',
    msg,
  });
});

test('withdraw builds ft_withdraw on ACCESS with amount:null and 1 yocto', () => {
  const actions = buildWithdrawActions();
  assert.equal(actions.length, 1);
  const fc = actions[0].functionCall;
  assert.ok(fc);
  assert.equal(fc.methodName, 'ft_withdraw');
  assert.equal(fc.gas, 250n * 10n ** 12n);
  assert.equal(fc.deposit, 1n);
  assert.deepEqual(decodeArgs(fc), { amount: null });
});

test('purchase message matches the contract `action` tag exactly', () => {
  assert.equal(
    purchaseMessage({ traderId: 'ops.near', planVersion: 2, purchaseId: 'web-9' }),
    JSON.stringify({ action: 'purchase', trader_id: 'ops.near', plan_version: 2, purchase_id: 'web-9' }),
  );
});