import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireAppConfig, type AppConfig } from '@keyfolio/domain';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

const MAX = '340282366920938463463374607431768211455';
const OVERFLOW = '340282366920938463463374607431768211456';

function fixtureApp(): FastifyInstance {
  return buildApp(requireAppConfig({ KEYFOLIO_MODE: 'FIXTURE' }));
}

async function post(app: FastifyInstance, payload: unknown) {
  // light-my-request serializes object payloads to JSON; non-object payloads
  // (numbers, missing bodies) are exercised through the JSON string case below.
  return app.inject({ method: 'POST', url: '/internal/validate-amount', payload: payload as object | string });
}

test('Fastify injection accepts canonical string amounts', async () => {
  const app = fixtureApp();
  try {
    for (const amount of ['0', '1', '10', MAX]) {
      const res = await post(app, { amount });
      assert.equal(res.statusCode, 200, `expected 200 for "${amount}"`);
      assert.deepEqual(res.json().data, { valid: true, amount, network: null });
      assert.equal(res.json().error, null);
    }
  } finally {
    await app.close();
  }
});

test('Fastify injection rejects JSON number 1.5 AND string "1.5" (422, invalid_amount)', async () => {
  const app = fixtureApp();
  try {
    const rejected: unknown[] = [
      { amount: 1.5 },
      { amount: '1.5' },
      { amount: 1 },
      { amount: 0 },
      { amount: 123 },
      { amount: '1.0' },
      { amount: '01' },
      { amount: '-1' },
      { amount: '1e3' },
      { amount: ' 1' },
      { amount: OVERFLOW },
      {},
    ];
    for (const payload of rejected) {
      const res = await post(app, payload);
      assert.equal(res.statusCode, 422, `expected 422 for ${JSON.stringify(payload)}`);
      const body = res.json();
      assert.equal(body.error.code, 'invalid_amount', `code for ${JSON.stringify(payload)}`);
      assert.equal(body.error.retryable, false);
      assert.equal(body.data, null);
      assert.equal(typeof body.meta.request_id, 'string');
    }
  } finally {
    await app.close();
  }
});

test('Fastify injection rejects an unknown network id (422, unknown_network)', async () => {
  const app = fixtureApp();
  try {
    const res = await post(app, { amount: '5', network: 'mysterynet' });
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'unknown_network');
  } finally {
    await app.close();
  }
});

test('Fastify injection accepts a known network id', async () => {
  const app = fixtureApp();
  try {
    const res = await post(app, { amount: '5', network: 'mainnet' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().data, { valid: true, amount: '5', network: 'mainnet' });
  } finally {
    await app.close();
  }
});

test('the amount seam is unreachable in TESTNET and LIVE (404)', async () => {
  const testnet: AppConfig = {
    mode: 'TESTNET',
    network: 'testnet',
    present: [],
    missingRequired: [],
    deferredWarnings: [],
  };
  const live: AppConfig = {
    mode: 'LIVE',
    network: 'mainnet',
    present: [],
    missingRequired: [],
    deferredWarnings: [],
  };
  for (const config of [testnet, live]) {
    const app = buildApp(config);
    try {
      const res = await post(app, { amount: '5' });
      assert.equal(res.statusCode, 404, `${config.mode} must not expose the fixture seam`);
    } finally {
      await app.close();
    }
  }
});