import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseMode, type KeyfolioMode } from '../src/mode.js';
import { parseNetwork } from '../src/network.js';
import { resolveAppConfig, requireAppConfig } from '../src/config.js';

test('KEYFOLIO_MODE is required and never defaults to fixture', () => {
  assert.equal(resolveAppConfig({}).ok, false);
  assert.equal(resolveAppConfig({ KEYFOLIO_MODE: undefined }).ok, false);
  assert.equal(resolveAppConfig({ KEYFOLIO_MODE: '' }).ok, false);
  assert.equal(resolveAppConfig({ KEYFOLIO_MODE: 'fixture' }).ok, false, 'lowercase must not be accepted');
  assert.equal(parseMode('LIVE').ok, true);
  assert.equal(parseMode('garbage').ok, false);
  assert.throws(() => requireAppConfig({}), /KEYFOLIO_MODE/);
});

test('FIXTURE mode needs no external secrets', () => {
  const r = resolveAppConfig({ KEYFOLIO_MODE: 'FIXTURE' });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.config.mode, 'FIXTURE');
    assert.equal(r.config.missingRequired.length, 0);
    assert.equal(r.config.network, null);
  }
});

test('TESTNET mode fails clearly without its required source/db configuration', () => {
  const r = resolveAppConfig({ KEYFOLIO_MODE: 'TESTNET' });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.reason.includes('DATABASE_URL'));
    assert.ok(r.reason.includes('PROVIDER_BASE_URL'));
    assert.ok(r.missingRequired.includes('NEAR_NETWORK'));
  }
});

test('TESTNET rejects a mainnet network and accepts a complete testnet config', () => {
  const wrong = resolveAppConfig({ KEYFOLIO_MODE: 'TESTNET', NEAR_NETWORK: 'mainnet' });
  assert.equal(wrong.ok, false);

  const good = resolveAppConfig({
    KEYFOLIO_MODE: 'TESTNET',
    NEAR_NETWORK: 'testnet',
    NEAR_RPC_URL: 'https://rpc.testnet.example',
    DATABASE_URL: 'postgres://example',
    PROVIDER_BASE_URL: 'https://provider.example',
  });
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.config.network, 'testnet');
});

test('LIVE mode requires contract identities and mainnet', () => {
  const missingContract = resolveAppConfig({
    KEYFOLIO_MODE: 'LIVE',
    NEAR_NETWORK: 'mainnet',
    NEAR_RPC_URL: 'https://rpc.mainnet.example',
    DATABASE_URL: 'postgres://example',
    PROVIDER_BASE_URL: 'https://provider.example',
  });
  assert.equal(missingContract.ok, false);

  const wrongNet = resolveAppConfig({
    KEYFOLIO_MODE: 'LIVE',
    NEAR_NETWORK: 'testnet',
    NEAR_RPC_URL: 'x',
    DATABASE_URL: 'x',
    PROVIDER_BASE_URL: 'x',
    ACCESS_CONTRACT_ID: 'x',
    SUBSCRIPTION_FT_CONTRACT_ID: 'x',
  });
  assert.equal(wrongNet.ok, false);

  const good = resolveAppConfig({
    KEYFOLIO_MODE: 'LIVE',
    NEAR_NETWORK: 'mainnet',
    NEAR_RPC_URL: 'https://rpc.mainnet.example',
    DATABASE_URL: 'postgres://example',
    PROVIDER_BASE_URL: 'https://provider.example',
    ACCESS_CONTRACT_ID: 'access.mainnet',
    SUBSCRIPTION_FT_CONTRACT_ID: 'ft.mainnet',
  });
  assert.equal(good.ok, true);
});

test('unknown networks are rejected', () => {
  assert.deepEqual(parseNetwork('mainnet'), { ok: true, value: 'mainnet' });
  assert.deepEqual(parseNetwork('testnet'), { ok: true, value: 'testnet' });
  for (const bad of ['localnet', 'Mainnet', 'bsc', '0x1', 1, null, undefined]) {
    assert.equal(parseNetwork(bad).ok, false, `expected rejection of ${JSON.stringify(bad)}`);
  }
  const cfg = resolveAppConfig({ KEYFOLIO_MODE: 'FIXTURE', NEAR_NETWORK: 'mysterynet' });
  assert.equal(cfg.ok, false);
});

test('recognized-but-deferred secrets warn, without failing the slice', () => {
  const r = resolveAppConfig({ KEYFOLIO_MODE: 'FIXTURE' });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.ok(Array.isArray(r.config.deferredWarnings));
    assert.ok(r.config.deferredWarnings.includes('SESSION_SECRET'));
  }
});

test('requireAppConfig returns a typed config for a valid fixture env', () => {
  const cfg = requireAppConfig({ KEYFOLIO_MODE: 'FIXTURE' });
  const _m: KeyfolioMode = cfg.mode;
  assert.equal(_m, 'FIXTURE');
});