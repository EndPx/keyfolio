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

test('landing uses a sparse staged journey with the product relationship in the first visual', async () => {
  const source = await readFile(new URL('../src/components/LandingClient.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  assert.match(source, /relationship-map/);
  assert.match(source, /journey-sticky/);
  assert.match(source, /scene-stage/);
  assert.match(source, /Choose a trader/);
  assert.match(source, /Compare coverage/);
  assert.match(source, /Buy access key/);
  assert.match(source, /Unlock private\/API/);
  assert.match(source, /Copy when eligible/);
  assert.doesNotMatch(source, /process-step|proof-grid/);
  assert.match(css, /\.journey-section\{position:relative;min-height:500vh/);
  assert.match(css, /\.landing\[data-step="4"\] \.scene-art/);
});

test('landing keeps CTA hierarchy and accessible mode status', async () => {
  const source = await readFile(new URL('../src/components/LandingClient.tsx', import.meta.url), 'utf8');
  assert.match(source, /className="sr-only" role="status"/);
  assert.match(source, /Browse traders/);
  assert.match(source, /Open the demo/);
  assert.doesNotMatch(source, /hero-scenario|wallet-state/);
});
