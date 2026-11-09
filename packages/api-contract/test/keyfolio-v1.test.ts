import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildOpenApiDocument, ERROR_STATUS, PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX, SECTION_11_ROUTES, validateListQuery } from '../src/index.js';

test('KF-02b freezes all section 11 routes and explicit status semantics', () => {
  assert.equal(SECTION_11_ROUTES.length, 14);
  assert.equal(new Set(SECTION_11_ROUTES.map((r) => `${r.method} ${r.path}`)).size, 14);
  assert.equal(SECTION_11_ROUTES.find((r) => r.path === '/v1/traders/:id/activity')?.auth, 'entitled');
  assert.equal(SECTION_11_ROUTES.find((r) => r.path === '/v1/traders')?.auth, 'public');
  assert.equal(ERROR_STATUS.entitlement_required, 403);
  assert.equal(ERROR_STATUS.authorization_freshness_unavailable, 503);
});

test('opaque cursor and page limits are strict, defaulting to 50', () => {
  assert.deepEqual(validateListQuery({}), { ok: true, value: { cursor: undefined, limit: PAGE_LIMIT_DEFAULT } });
  assert.deepEqual(validateListQuery({ cursor: 'opaque', limit: PAGE_LIMIT_MAX }), { ok: true, value: { cursor: 'opaque', limit: 100 } });
  assert.equal(validateListQuery({ limit: 0 }).ok, false);
  assert.equal(validateListQuery({ limit: 101 }).ok, false);
  assert.equal(validateListQuery({ limit: 1.5 }).ok, false);
  assert.equal(validateListQuery({ cursor: '' }).ok, false);
  assert.equal(validateListQuery({ cursor: 3 }).ok, false);
});

test('checked-in OpenAPI artifact is deterministic and contains every frozen route', async () => {
  const artifact = JSON.parse(await readFile(new URL('../../../docs/openapi/keyfolio-v1.json', import.meta.url), 'utf8'));
  assert.deepEqual(artifact, buildOpenApiDocument());
  for (const route of SECTION_11_ROUTES) {
    const path = route.path.replaceAll(/:([A-Za-z0-9_]+)/g, '{$1}');
    assert.ok((artifact.paths as Record<string, Record<string, unknown>>)[path]?.[route.method.toLowerCase()], `${route.method} ${route.path} missing`);
  }
});
