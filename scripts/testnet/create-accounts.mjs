// Create Keyfolio testnet accounts via the same public faucet service the
// near-cli uses (https://near-faucet.io). Secrets are generated locally and
// saved under .deploy-local/keys/ (gitignored) — never printed, never
// committed. Run: node create-accounts.mjs
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import nearApi from 'near-api-js';
const { KeyPair } = nearApi;

const here = dirname(fileURLToPath(import.meta.url));
const keysDir = process.env.KEYS_DIR ?? join(here, '..', '..', '.deploy-local', 'testnet-tools', 'keys');
mkdirSync(keysDir, { recursive: true });

const ACCOUNTS = ['keyfolio-ops', 'keyfolio-monitor', 'keyfolio-access', 'keyfolio-usdc'];
const FAUCET = 'https://helper.testnet.near.org/account';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function faucetCreate(accountId, publicKey) {
  // The faucet service expects the new account id and its future full-access
  // public key; different versions use slightly different field names, so
  // try the documented shape first, then the CLI's shape.
  const bodies = [
    { new_account_id: accountId, new_account_public_key: publicKey },
    { newAccountId: accountId, newAccountPublicKey: publicKey },
  ];
  let last = '';
  for (const body of bodies) {
    const res = await fetch(FAUCET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) return { ok: true, status: res.status, text: text.slice(0, 200) };
    last = `${res.status} ${text.slice(0, 200)}`;
  }
  return { ok: false, status: 'error', text: last };
}

async function accountExists(accountId) {
  const res = await fetch('https://rpc.testnet.near.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 'k', method: 'query',
      params: { request_type: 'view_account', finality: 'final', account_id: accountId },
    }),
  });
  const j = await res.json();
  return j?.result != null;
}

for (const name of ACCOUNTS) {
  const accountId = `${name}.testnet`;
  const keyFile = join(keysDir, `${accountId}.json`);
  if (existsSync(keyFile)) {
    console.log(`${accountId}: key file already exists, skipping (not re-funding)`);
    continue;
  }
  if (await accountExists(accountId)) {
    console.log(`${accountId}: already exists on testnet; skip creation (no key on this machine)`);
    continue;
  }
  const kp = KeyPair.fromRandom("ed25519");
  const result = await faucetCreate(accountId, kp.getPublicKey().toString());
  if (!result.ok) {
    console.log(`${accountId}: FAILED — ${result.text}`);
    continue;
  }
  writeFileSync(
    keyFile,
    JSON.stringify({ account_id: accountId, public_key: kp.getPublicKey().toString(), secret_key: kp.toString() }, null, 2),
  );
  console.log(`${accountId}: created (secret saved to .deploy-local/keys/)`);
  await sleep(20_000); // faucet rate limit
}
console.log('done');
