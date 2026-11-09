import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('web root restores the dashboard and marketplace alias remains available', async () => {
  const root = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const marketplace = await readFile(new URL('../src/app/marketplace/page.tsx', import.meta.url), 'utf8');
  assert.match(root, /MarketplacePage/);
  assert.doesNotMatch(root, /LandingClient/);
  assert.match(marketplace, /MarketplacePage/);
  assert.match(marketplace, /MARKET_SELLERS/);
});
