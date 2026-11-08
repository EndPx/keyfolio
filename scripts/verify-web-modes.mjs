// Verification for review KF-08b.1 finding 2: the three demo routes must
// serve FIXTURE data ONLY in FIXTURE mode, and must serve ZERO fixture
// numbers/sellers/orders in TESTNET (valid config), LIVE (valid config) and
// invalid-config modes. Starts its own `next start` instances against the
// built app (run `pnpm --filter @keyfolio/web build` first).
// Usage: node scripts/verify-web-modes.mjs
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

// Fixture markers that must NEVER appear outside FIXTURE mode.
const FIXTURE_MARKERS = ['Carla', 'carla.near', '+214.50', '25.000000', '8.24', 'DeltaOne', 'Esteban'];

const MODES = [
  {
    name: 'FIXTURE',
    env: { KEYFOLIO_MODE: 'FIXTURE' },
    expect: 'fixture', // fixture markers PRESENT on all routes
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
    expect: 'gated',
  },
  {
    name: 'LIVE (valid synthetic config)',
    env: {
      KEYFOLIO_MODE: 'LIVE',
      NEAR_NETWORK: 'mainnet',
      NEAR_RPC_URL: 'https://rpc.mainnet.near.org',
      DATABASE_URL: 'postgres://synthetic:synthetic@127.0.0.1:1/synthetic',
      PROVIDER_BASE_URL: 'https://provider.synthetic.example',
      ACCESS_CONTRACT_ID: 'access.synthetic.testnet',
      SUBSCRIPTION_FT_CONTRACT_ID: 'ft.synthetic.testnet',
    },
    expect: 'gated',
  },
  {
    name: 'invalid config',
    env: { KEYFOLIO_MODE: 'GARBAGE' },
    expect: 'config-error',
  },
];

let failures = 0;

function startServer(port, env) {
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port)], {
    cwd: webDir,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
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
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  for (const [modeIndex, mode] of MODES.entries()) {
    const port = BASE_PORT + modeIndex;
    const child = startServer(port, mode.env);
    try {
      if (!(await waitReady(port))) {
        throw new Error(`server did not become ready for ${mode.name}`);
      }
      for (const route of ROUTES) {
        const { status, text } = await getBody(route, port);
        if (status !== 200) {
          throw new Error(`[${mode.name}] ${route} returned HTTP ${status}`);
        }
        const leaked = FIXTURE_MARKERS.filter((m) => text.includes(m));
        if (mode.expect === 'fixture') {
          if (leaked.length === 0) {
            throw new Error(`[${mode.name}] ${route}: expected fixture markers, found none`);
          }
        } else if (leaked.length > 0) {
          throw new Error(`[${mode.name}] ${route}: FIXTURE LEAK detected: ${leaked.join(', ')}`);
        }
        const expects = {
          fixture: () => null, // presence already asserted via markers
          gated: () => {
            if (!/mode is active|not connected|data source/i.test(text)) {
              throw new Error(`[${mode.name}] ${route}: missing the explicit not-connected explanation`);
            }
          },
          'config-error': () => {
            if (!/unknown KEYFOLIO_MODE|Configuration error/i.test(text)) {
              throw new Error(`[${mode.name}] ${route}: missing the config error explanation`);
            }
          },
        };
        if (mode.expect !== 'fixture') expects[mode.expect]();
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
  console.log('VERIFY-WEB-MODES PASSED: fixture data confined to FIXTURE mode across all routes');
}

await main();
