import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureAdapter, createProviderAdapter, ProviderCapabilityError } from '../src/index.js';

test('fixture adapter preserves source time/provenance and account-following seam', async () => {
  const adapter = createFixtureAdapter('FIXTURE', () => '2026-11-10T00:00:00.000Z');
  const auth = await adapter.authenticate({ account: 'trader.near', authorization: 'fixture' });
  assert.equal(auth.provenance.source, 'FIXTURE_ONLY');
  assert.equal(auth.provenance.source_time.trust, 'trusted');
  const identity = await adapter.getIdentity(auth.connection_reference);
  assert.equal(identity.account, 'trader.near');
  const balances = await adapter.getBalances(auth.connection_reference);
  assert.equal(balances[0]?.atomic_amount, '0');
  const activity = await adapter.listActivity(auth.connection_reference);
  assert.deepEqual(activity.items, []);
  await adapter.revokeOrDisconnect(auth.connection_reference);
  await assert.rejects(() => adapter.getIdentity(auth.connection_reference), ProviderCapabilityError);
});

test('fixture source fails closed in TESTNET and LIVE; no guessed upstream route', () => {
  assert.throws(() => createFixtureAdapter('TESTNET'), ProviderCapabilityError);
  assert.throws(() => createFixtureAdapter('LIVE'), ProviderCapabilityError);
  assert.throws(() => createProviderAdapter('TESTNET'), /BLOCKED_EXTERNAL/);
  assert.throws(() => createProviderAdapter('LIVE'), /BLOCKED_EXTERNAL/);
});
