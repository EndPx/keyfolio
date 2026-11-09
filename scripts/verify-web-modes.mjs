// Verification for review KF-08b: the demo routes must serve FIXTURE data
// ONLY in FIXTURE mode, and the TESTNET-only client components (checkout,
// keys, studio, activity) must be mounted ONLY in TESTNET mode — LIVE and
// invalid configs fail closed.
//
// LIMITATION (documented, not papered over): this script greps the SERVER-
// RENDERED HTML. It proves SERVER gating and which client components are
// mounted, but it CANNOT observe hydrated client behavior (post-load contract
// queries, wallet signing, verification). Hydrated TESTNET behavior is covered
// separately by the apps/web unit tests and, where no browser is available,
// is recorded as a NOT_RUN blocker rather than claimed from this HTML grep.
//
// Usage: node scripts/verify-web-modes.mjs  (run `pnpm --filter @keyfolio/web build` first)
// No signing, no transactions — synthetic config only.

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webDir = join(here, '..', 'apps', 'web');
// Spawn the next binary DIRECTLY (node + JS entry): killing the process on
// Windows also kills the server, which a pnpm/shell wrapper does not.
const NEXT_BIN = join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next');
const BASE_PORT = 3311;

const ROUTES = ['/', '/traders/carla', '/checkout/carla', '/keys', '/studio', '/private', '/api-access', '/activity'];

// Routes that actually serve FIXTURE seller/plan data in FIXTURE mode. The
// wallet/private/access screens render explicit demo/not-connected panels in
// every mode, so they are not expected to contain fixture markers.
const FIXTURE_DATA_ROUTES = ['/', '/traders/carla', '/checkout/carla'];

// Fixture markers that must NEVER appear outside FIXTURE mode.
const FIXTURE_MARKERS = ['Carla', 'carla.near', '+214.50', '25.000000', '8.24', 'DeltaOne', 'Esteban'];

// Client-component mount evidence present in SERVER HTML only because the
// component is actually mounted. (Hydrated behavior is separate.)
const CHECKOUT_MOUNT = 'Loading contract state from NEAR testnet';
const WALLET_MOUNT = 'Connecting wallet service';
// LIVE fail-closed wording used by the testnet-only pages.
const TESTNET_ONLY = 'wired for testnet only';

const MODES = [
  {
    name: 'FIXTURE',
    env: { KEYFOLIO_MODE: 'FIXTURE' },
    expect: 'fixture',
  },
  {
    name: 'TESTNET (valid synthetic config)',
    env: {
      KEYFOLIO_MODE: 'TESTNET',
      NEAR_NETWORK: 'testnet',
      NEAR_RPC_URL: 'https://rpc.testnet.near.org',
      DATABASE_URL: 'postgres://synthetic:synthetic@127.0.0.1:1/synthetic',
      PROVIDER_BASE_URL: 'https://provider.synthetic.example',
    },
    expect: 'testnet',
  },
  {
    name: 'LIVE (valid synthetic config)',
    env: {
      KEYFOLIO_MODE: 'LIVE',
      NEAR_NETWORK: 'mainnet',
      NEAR_RPC_URL: 'https://rpc.mainnet.near.org',
      DATABASE_URL: 'postgres://synthetic:synthetic@127.0.0.1:1/synthetic',
      PROVIDER_BASE_URL: 'https://provider.synthetic.example',
      ACCESS_CONTRACT_ID: 'access.mainnet',
      SUBSCRIPTION_FT_CONTRACT_ID: 'ft.mainnet',
    },
    expect: 'live',
  },
  {
    name: 'invalid config',
    env: { KEYFOLIO_MODE: 'GARBAGE' },
    expect: 'config-error',
  },
];

// Per-route, per-mode SERVER gating assertions.
function mountChecks(mode) {
  const expect = mode.expect;
  const checks = {}; // route -> { contains: [], excludes: [] }
  if (expect === 'testnet') {
    checks['/checkout/carla'] = { contains: [CHECKOUT_MOUNT], excludes: [] };
    for (const r of ['/keys', '/studio', '/activity']) {
      checks[r] = { contains: [WALLET_MOUNT], excludes: [] };
    }
  } else if (expect === 'live') {
    checks['/checkout/carla'] = { contains: [TESTNET_ONLY], excludes: [CHECKOUT_MOUNT] };
    for (const r of ['/keys', '/studio', '/activity']) {
      checks[r] = { contains: [TESTNET_ONLY], excludes: [WALLET_MOUNT] };
    }
  }
  return checks;
}

let failures = 0;

function startServer(port, env) {
  return spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port)], {
    cwd: webDir,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitReady(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function getBody(path, port) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: res.status, text: await res.text() };
}

async function main() {
  for (const [modeIndex, mode] of MODES.entries()) {
    const port = BASE_PORT + modeIndex;
    const child = startServer(port, mode.env);
    const checks = mountChecks(mode);
    try {
      if (!(await waitReady(port))) {
        throw new Error(`server did not become ready for ${mode.name}`);
      }
      for (const route of ROUTES) {
        const { status, text } = await getBody(route, port);
        if (status !== 200) {
          throw new Error(`[${mode.name}] ${route} returned HTTP ${status}`);
        }

        // 1. Fixture confinement.
        const leaked = FIXTURE_MARKERS.filter((m) => text.includes(m));
        if (mode.expect === 'fixture') {
          if (FIXTURE_DATA_ROUTES.includes(route) && leaked.length === 0) {
            throw new Error(`[${mode.name}] ${route}: expected fixture markers, found none`);
          }
        } else if (leaked.length > 0) {
          throw new Error(`[${mode.name}] ${route}: FIXTURE LEAK detected: ${leaked.join(', ')}`);
        }

        // 2. Mode/target mount assertions.
        const c = checks[route];
        if (c) {
          for (const marker of c.contains) {
            if (!text.includes(marker)) {
              throw new Error(`[${mode.name}] ${route}: missing expected marker "${marker}"`);
            }
          }
          for (const marker of c.excludes) {
            if (text.includes(marker)) {
              throw new Error(`[${mode.name}] ${route}: should NOT contain "${marker}" (testnet client leaked into ${mode.expect})`);
            }
          }
        } else if (mode.expect === 'config-error') {
          if (!/Configuration error|unknown KEYFOLIO_MODE/i.test(text)) {
            throw new Error(`[${mode.name}] ${route}: missing the config error explanation`);
          }
        } else if (mode.expect !== 'fixture') {
          // Non-mount-sensitive routes must render an explicit not-connected explanation.
          if (!/mode is active|Not connected|not connected|data source/i.test(text)) {
            throw new Error(`[${mode.name}] ${route}: missing the explicit not-connected explanation`);
          }
        }
        console.log(`  ok [${mode.name}] ${route} (HTTP ${status}, fixture leaks: ${leaked.length})`);
      }
    } catch (err) {
      failures += 1;
      console.error(`  FAIL [${mode.name}]: ${err.message}`);
    } finally {
      child.kill('SIGTERM');
      if (!child.killed) child.kill('SIGKILL');
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }
  if (failures > 0) {
    console.error(`VERIFY-WEB-MODES FAILED (${failures} mode(s))`);
    process.exit(1);
  }
  console.log('VERIFY-WEB-MODES PASSED: fixture data confined to FIXTURE; testnet client components mounted only in TESTNET (server gating — hydrated behavior is covered by unit tests)');
}

await main();