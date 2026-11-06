import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveMigrationTarget } from '../../../scripts/migration-target.js';

test('external migration requires DATABASE_URL (no implicit ephemeral fallback)', () => {
  for (const value of [undefined, '', '   ']) {
    const r = resolveMigrationTarget({ DATABASE_URL: value });
    assert.equal(r.kind, 'missing_url', `DATABASE_URL=${JSON.stringify(value)} must require a real value`);
    assert.equal('url' in r, false, 'missing_url result carries no url');
    if (r.kind === 'missing_url') {
      assert.match(r.reason, /DATABASE_URL is required/);
      assert.match(r.reason, /db:migrate:local/, 'reason points at the explicit local command');
    }
  }
});

test('external migration resolves a target URL without ever choosing ephemeral', () => {
  const url = 'postgres://user:pass@example.invalid:5432/keyfolio';
  const r = resolveMigrationTarget({ DATABASE_URL: url });
  assert.deepEqual(r, { kind: 'external', url });
});