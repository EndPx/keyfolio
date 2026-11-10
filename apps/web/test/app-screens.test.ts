import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = (name: string) => readFile(new URL(`../src/app/${name}/page.tsx`, import.meta.url), 'utf8');

test('remaining app routes render the analytical screen contract', async () => {
  for (const route of ['keys', 'private', 'api-access', 'activity', 'studio']) {
    const source = await page(route);
    assert.match(source, /ScreenHeader/);
    assert.match(source, /ModePanel/);
    assert.match(source, /FixtureTag/);
    assert.match(source, /WalletState/);
  }
});

test('non-fixture branches are explicit and do not fall back to sample panels', async () => {
  const sources = await Promise.all(['keys', 'private', 'api-access', 'activity', 'studio'].map(page));
  for (const source of sources) {
    assert.match(source, /testnet=/);
    assert.match(source, /TESTNET/);
    assert.match(source, /mode-blocked/);
  }
});

test('read-only visual slice cannot invoke transaction builders', async () => {
  const sources = await Promise.all(['keys', 'private', 'api-access', 'activity', 'studio'].map(page));
  for (const source of sources) {
    assert.doesNotMatch(source, /signAndSendTransaction|buildWithdrawActions|buildPurchaseActions/);
  }
});
