import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireAppConfig } from '@keyfolio/domain';
import { buildApp } from '../src/app.js';

test('GET /health returns mode/build info and no fake provider readiness', async () => {
  const config = requireAppConfig({ KEYFOLIO_MODE: 'FIXTURE' });
  const app = buildApp(config);
  try {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.error, null);
    assert.equal(typeof body.data.mode, 'string');
    assert.equal(body.data.mode, 'FIXTURE');
    assert.equal(body.data.provider, 'unconfigured', 'no fake provider readiness');
    assert.equal(body.data.build.name, 'keyfolio-api');
    assert.equal(typeof body.data.build.version, 'string');
    assert.equal(typeof body.data.build.commit, 'string');
    assert.equal(body.data.network, null);

    assert.equal(typeof body.meta.request_id, 'string');
    assert.ok(body.meta.request_id.length > 0);
    assert.equal(body.meta.coverage, 'none');
    assert.equal(body.meta.stale, false);
    assert.ok(!Number.isNaN(Date.parse(body.meta.observed_at)), 'observed_at is a parseable timestamp');
    assert.ok(body.meta.observed_at.endsWith('Z'), 'observed_at is UTC');
  } finally {
    await app.close();
  }
});