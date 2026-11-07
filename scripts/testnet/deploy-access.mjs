// Deploy the Keyfolio access contract to TESTNET and run the first smoke
// views. Secrets come from .deploy-local/keys/ and are never printed.
// Run: node deploy.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import nearApi from 'near-api-js';

const here = dirname(fileURLToPath(import.meta.url));
const keysDir = process.env.KEYS_DIR ?? join(here, '..', '..', '.deploy-local', 'testnet-tools', 'keys');
const WASM = process.argv[2] || join(here, '..', '..', 'contracts', 'access', 'target', 'wasm32-unknown-unknown', 'release', 'access.wasm');

const { Account, KeyPair, KeyPairSigner, providers } = nearApi;
const provider = new providers.JsonRpcProvider({ url: 'https://rpc.testnet.near.org' });
function accFor(accountId) {
  return new Account(accountId, provider, signerFor(accountId));
}

function loadKey(accountId) {
  const j = JSON.parse(readFileSync(join(keysDir, `${accountId}.json`), 'utf8'));
  return j.secret_key;
}

function rpc(method, params) {
  return fetch('https://rpc.testnet.near.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'k', method, params }),
  }).then((r) => r.json());
}

async function viewAccount(accountId) {
  const j = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: accountId });
  return j.result;
}

async function callView(accountId, methodName, args) {
  const j = await rpc('query', {
    request_type: 'call_function',
    finality: 'final',
    account_id: accountId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args ?? {})).toString('base64'),
  });
  if (j.error) throw new Error(`view ${methodName}: ${JSON.stringify(j.error)}`);
  return JSON.parse(Buffer.from(j.result.result).toString());
}

function signerFor(accountId) {
  return new KeyPairSigner(KeyPair.fromString(loadKey(accountId)));
}

const ACCESS = 'keyfolio-access.testnet';
const OPS = 'keyfolio-ops.testnet';
const MONITOR = 'keyfolio-monitor.testnet';
const FT = 'keyfolio-usdc.testnet'; // future mock FT; not required for the first smoke

const wasm = new Uint8Array(readFileSync(WASM));
console.log(`wasm bytes: ${wasm.length}`);
console.log('crypto hash recorded separately');

// --- balances ---------------------------------------------------------------
const balAccess = await viewAccount(ACCESS);
console.log(`access balance: ${Number(balAccess.amount) / 1e24} NEAR`);

// Contract storage stake for a ~514 KB wasm is roughly 5-6 NEAR plus state;
// top up from the operator if the faucet balance looks short.
const MIN_NEEDED = 8n * 10n ** 24n;
if (BigInt(balAccess.amount) < MIN_NEEDED) {
  console.log('topping up access from ops…');
  const opsAcc = accFor(OPS);
  await opsAcc.signAndSendTransaction({
    receiverId: ACCESS,
    actions: [nearApi.transactions.transfer(MIN_NEEDED - BigInt(balAccess.amount))],
  });
  console.log(`access balance now: ${Number((await viewAccount(ACCESS)).amount) / 1e24} NEAR`);
}

// --- deploy ------------------------------------------------------------------
const accessAcc = accFor(ACCESS);

console.log('deploying contract…');
const deployRes = await accessAcc.deployContract(wasm);
console.log(`deploy tx: ${deployRes.transaction?.hash ?? deployRes.transaction_outcome?.id ?? 'n/a'}`);

console.log('initializing (new)…');
await accessAcc.functionCall({
  contractId: ACCESS,
  methodName: 'new',
  args: { owner_id: OPS, monitor_id: MONITOR, ft_id: FT },
  gas: 50_000_000_000_000n,
});

// --- smoke views --------------------------------------------------------------
console.log('contract_info:', JSON.stringify(await callView(ACCESS, 'contract_info')));
console.log('access balance after deploy:', Number((await viewAccount(ACCESS)).amount) / 1e24, 'NEAR');

// --- publish the F-VEST plan (operator) --------------------------------------
const opsAcc = accFor(OPS);
await opsAcc.functionCall({
  contractId: ACCESS,
  methodName: 'set_plan',
  args: { trader_id: OPS, version: 1, price: '101', term_ms: 10_000 },
  gas: 50_000_000_000_000n,
});
console.log('current_plan:', JSON.stringify(await callView(ACCESS, 'get_current_plan', { trader_id: OPS })));
console.log('DONE');
