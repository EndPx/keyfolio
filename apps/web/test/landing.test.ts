import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getLandingWalletState } from '../src/components/landingContract';

test('landing wallet CTA is fail-closed or explicitly simulated by mode', () => {
  assert.equal(getLandingWalletState('FIXTURE').label, 'Preview wallet');
  assert.match(getLandingWalletState('FIXTURE').message, /simulated state/);
  assert.equal(getLandingWalletState('TESTNET').label, 'Connect NEAR wallet');
  assert.equal(getLandingWalletState('LIVE').canAct, false);
  assert.match(getLandingWalletState('LIVE').message, /fail-closed/);
});

test('landing and marketplace routes preserve the public route contract', async () => {
  const landing = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const marketplace = await readFile(new URL('../src/app/marketplace/page.tsx', import.meta.url), 'utf8');
  assert.match(landing, /LandingClient/);
  assert.match(marketplace, /MarketplacePage/);
  assert.match(marketplace, /MARKET_SELLERS/);
});
