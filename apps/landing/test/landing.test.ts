import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getLandingWalletState } from '../src/components/landingContract';

test('landing wallet CTA is explicit by mode and fail-closed for LIVE', () => {
  assert.equal(getLandingWalletState('FIXTURE').label, 'Open the demo');
  assert.match(getLandingWalletState('FIXTURE').message, /simulated/);
  assert.equal(getLandingWalletState('TESTNET').label, 'Connect NEAR wallet');
  assert.equal(getLandingWalletState('LIVE').canAct, false);
  assert.match(getLandingWalletState('LIVE').message, /unavailable|production gates/);
});

test('landing owns its marketing route and does not render the app shell', async () => {
  const page = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  assert.match(page, /LandingClient/);
  assert.doesNotMatch(layout, /SideNav|EnvBanner/);
});
