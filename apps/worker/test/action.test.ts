import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decideWorkerAction } from '../src/action.js';

test('FIXTURE worker is an idle, clean-exit entrypoint', () => {
  const a = decideWorkerAction('FIXTURE');
  assert.equal(a.kind, 'idle_exit');
  assert.match(a.message, /FIXTURE idle entrypoint/);
});

test('TESTNET and LIVE workers refuse to fake a source/signer', () => {
  for (const mode of ['TESTNET', 'LIVE'] as const) {
    const a = decideWorkerAction(mode);
    assert.equal(a.kind, 'refuse', `${mode} must refuse`);
    assert.match(a.message, /refusing to fake a source or signer/);
  }
});