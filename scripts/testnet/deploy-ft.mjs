// Deploy the mock FT to keyfolio-usdc.testnet and run the REAL testnet
// purchase/withdraw/refund smoke with strict assertions:
//  - every step checks RECEIPT outcomes (not just the tx outcome),
//  - FT balance deltas are asserted exactly,
//  - the refund MUST be positive (a zero refund fails the run),
//  - double initialization of both deployed contracts is proven rejected.
// Secrets stay outside Git: KEYS_DIR (default ../../.deploy-local/testnet-tools/keys).
// Run: node deploy-ft.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import nearApi from 'near-api-js';

const here = dirname(fileURLToPath(import.meta.url));
const keysDir = process.env.KEYS_DIR ?? join(here, '..', '..', '.deploy-local', 'testnet-tools', 'keys');
const WASM_FT = process.env.WASM_FT ?? join(here, '..', '..', 'contracts', 'mock-ft', 'target', 'wasm32-unknown-unknown', 'release', 'mock_ft.wasm');
const WASM_ACCESS = process.env.WASM_ACCESS ?? join(here, '..', '..', 'contracts', 'access', 'target', 'wasm32-unknown-unknown', 'release', 'access.wasm');

const { Account, KeyPair, KeyPairSigner, providers, transactions } = nearApi;
const provider = new providers.JsonRpcProvider({ url: 'https://rpc.testnet.near.org' });

const FT = 'keyfolio-usdc.testnet';
const ACCESS = 'keyfolio-access.testnet';
const OPS = 'keyfolio-ops.testnet'; // operator + trader role for the smoke
const MONITOR = 'keyfolio-monitor.testnet'; // monitor role AND buyer role (testnet labels only)
const BUYER = MONITOR;

const NEAR = 10n ** 24n;
const GAS = 120n * 10n ** 12n;

function signerFor(accountId) {
  return new KeyPairSigner(KeyPair.fromString(loadKey(accountId)));
}
function loadKey(accountId) {
  return JSON.parse(readFileSync(join(keysDir, `${accountId}.json`), 'utf8')).secret_key;
}
function accFor(accountId) {
  return new Account(accountId, provider, signerFor(accountId));
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function accountExists(accountId) {
  try {
    // near-api-js v6 provider.query throws UnknownAccount for missing accounts.
    await provider.query({ request_type: 'view_account', finality: 'final', account_id: accountId });
    return true;
  } catch {
    return false;
  }
}
async function callView(accountId, methodName, args) {
  // v6 query returns the raw RPC payload: { result: [bytes], logs } — decode
  // the byte array with the installed SDK's shape (buffer from result array).
  const res = await provider.query({
    request_type: 'call_function', finality: 'final', account_id: accountId,
    method_name: methodName, args_base64: Buffer.from(JSON.stringify(args ?? {})).toString('base64'),
  });
  if (res.error) throw new Error(`view ${methodName}: ${JSON.stringify(res.error)}`);
  return JSON.parse(Buffer.from(res.result).toString());
}
async function ftBalanceOf(who) {
  const v = await callView(FT, 'ft_balance_of', { account_id: who });
  return BigInt(v);
}

/**
 * Run one transaction and STRICTLY verify every receipt outcome succeeded.
 * Returns { txHash, value (SuccessValue parsed or null), receipts }.
 * A failing receipt anywhere throws with the failure detail.
 */
// near-api-js v6: functionCall/signAndSendTransaction return the awaited
// legacy FinalExecutionOutcome ({ transaction_outcome, receipts_outcome,
// status }) — there is no .transact() builder.
async function runTx(accountId, call) {
  const out = await call(accFor(accountId));
  const failures = [];
  const txStatus = out.transaction_outcome?.outcome?.status;
  if (txStatus?.Failure !== undefined) {
    failures.push(JSON.stringify(txStatus.Failure).slice(0, 300));
  }
  for (const r of out.receipts_outcome ?? []) {
    const s = r.outcome?.status;
    if (s?.Failure !== undefined) failures.push(JSON.stringify(s.Failure).slice(0, 300));
  }
  if (failures.length > 0) {
    throw new Error(`receipt failure(s) in tx ${out.transaction_outcome?.id}: ${failures.join(' | ')}`);
  }
  // Final value: the overall status's SuccessValue as RAW TEXT (no Number
  // coercion — U128 comparisons stay string-based, reviewer finding 4).
  const finalStatus = out.status ?? txStatus;
  const raw = finalStatus?.SuccessValue !== undefined && finalStatus.SuccessValue !== ''
    ? Buffer.from(finalStatus.SuccessValue, 'base64').toString()
    : null;
  return { txHash: out.transaction_outcome?.id, raw, receipts: out.receipts_outcome ?? [] };
}

/** Like runTx but EXPECTS at least one failing receipt (double-init etc.). */
async function runTxExpectFailure(accountId, call, needle) {
  const out = await call(accFor(accountId));
  const statuses = [out.transaction_outcome?.outcome?.status, ...(out.receipts_outcome ?? []).map((r) => r.outcome?.status)];
  const anyFailure = statuses.some((s) => s?.Failure !== undefined);
  if (!anyFailure) {
    throw new Error(`expected failure containing "${needle}" but the transaction succeeded`);
  }
  const joined = JSON.stringify(statuses);
  if (needle && !joined.includes(needle)) {
    throw new Error(`failure happened but without the expected cause "${needle}": ${joined.slice(0, 300)}`);
  }
  return true;
}

async function assertFtDelta(who, delta, label) {
  const after = await ftBalanceOf(who);
  if (after - (assertFtDelta.last?.[who] ?? 0n) !== delta) {
    throw new Error(`${label}: FT balance delta for ${who} expected ${delta}, got ${after - (assertFtDelta.last?.[who] ?? 0n)} (before ${assertFtDelta.last?.[who]}, after ${after})`);
  }
  console.log(`  ok: ${label} — ${who} delta ${delta} (balance now ${after})`);
}
function snapshotFt(who, value) {
  assertFtDelta.last = assertFtDelta.last ?? {};
  assertFtDelta.last[who] = value;
}

async function main() {
  // 1. Create the FT account if the faucet window allows it.
  if (!(await accountExists(FT))) {
    console.log(`${FT} does not exist — attempting faucet create…`);
    const kp = KeyPair.fromRandom('ed25519');
    const res = await fetch('https://helper.testnet.near.org/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newAccountId: FT, newAccountPublicKey: kp.getPublicKey().toString() }),
    });
    if (!res.ok) {
      console.log(`faucet refused: ${res.status} — stopping (no partial state created)`);
      process.exit(2);
    }
    writeFileSync(join(keysDir, `${FT}.json`), JSON.stringify({ account_id: FT, public_key: kp.getPublicKey().toString(), secret_key: kp.toString() }, null, 2));
    console.log(`${FT} created`);
    await sleep(5_000);
  }

  const ft = accFor(FT);

  // 2. Deploy + init the mock FT, then PROVE double init is rejected (T7).
  let needInit = true;
  try {
    const md = await callView(FT, 'ft_metadata');
    console.log(`FT already deployed: ${md.symbol} (ft_total_supply ${await callView(FT, 'ft_total_supply')})`);
    needInit = false;
  } catch {
    console.log('deploying mock FT…');
    const wasm = new Uint8Array(readFileSync(WASM_FT));
    await runTx(FT, (a) => a.deployContract(wasm));
  }
  if (needInit) {
    await runTx(FT, (a) =>
      a.functionCall({
        contractId: FT, methodName: 'new',
        args: { owner_id: OPS, total_supply: '1000000000000' },
        gas: GAS,
      }),
    );
  }
  const md = await callView(FT, 'ft_metadata');
  if (!md.name.includes('TEST')) throw new Error('mock FT metadata must be labeled TEST');
  console.log('FT ready:', md.symbol, 'supply', await callView(FT, 'ft_total_supply'));
  await runTxExpectFailure(FT, (a) =>
    a.functionCall({ contractId: FT, methodName: 'new', args: { owner_id: OPS, total_supply: '1' }, gas: GAS }),
    'already initialized',
  );
  console.log('  ok: double init on FT rejected on-chain');

  // 3. Register BUYER and the ACCESS contract as FT receivers (reviewer #3).
  for (const who of [BUYER, ACCESS]) {
    await runTx(who === BUYER ? BUYER : OPS, (a) =>
      a.functionCall({ contractId: FT, methodName: 'storage_deposit', args: { account_id: who }, attachedDeposit: NEAR / 10n, gas: GAS }),
    );
  }
  console.log('  ok: BUYER and ACCESS registered on the FT');

  // 4. Fund the buyer and assert the delta.
  snapshotFt(BUYER, await ftBalanceOf(BUYER));
  snapshotFt(OPS, await ftBalanceOf(OPS));
  snapshotFt(ACCESS, await ftBalanceOf(ACCESS));
  await runTx(OPS, (a) =>
    a.functionCall({ contractId: FT, methodName: 'ft_transfer', args: { receiver_id: BUYER, amount: '25000000', memo: 'smoke funding' }, attachedDeposit: 1n, gas: GAS }),
  );
  await assertFtDelta(BUYER, 25_000_000n, 'funding');

  // 5. Buyer prepays storage on the ACCESS contract (separate from price).
  await runTx(BUYER, (a) =>
    a.functionCall({ contractId: ACCESS, methodName: 'storage_deposit', args: { account_id: BUYER }, attachedDeposit: NEAR, gas: GAS }),
  );

  // 6. Purchase #1 via real ft_transfer_call; assert resolver value "0",
  //    license + tranche, and exact FT balance deltas.
  async function purchase(purchaseId) {
    snapshotFt(BUYER, await ftBalanceOf(BUYER));
    snapshotFt(ACCESS, await ftBalanceOf(ACCESS));
    const r = await runTx(BUYER, (a) =>
      a.functionCall({
        contractId: FT, methodName: 'ft_transfer_call',
        args: {
          receiver_id: ACCESS, amount: '101', memo: `purchase ${purchaseId}`,
          msg: JSON.stringify({ action: 'purchase', trader_id: OPS, plan_version: 1, purchase_id: purchaseId }),
        },
        attachedDeposit: 1n, gas: 250n * 10n ** 12n,
      }),
    );
    // NEP-141: the ft_transfer_call result is the SPENT amount (neps/nep-0141.md).
    if (r.value !== 101) throw new Error(`resolver returned ${r.value} for ${purchaseId}; expected the spent amount 101`);
    await assertFtDelta(BUYER, -101n, `purchase ${purchaseId}`);
    await assertFtDelta(ACCESS, 101n, `purchase ${purchaseId}`);
    const tid = `kf-${OPS}-${BUYER}-${purchaseId}`;
    const lic = await callView(ACCESS, 'get_license', { token_id: tid });
    if (!lic || lic.owner_id !== BUYER) throw new Error(`license missing/mis-owned after ${purchaseId}: ${JSON.stringify(lic)}`);
    const tranches = await callView(ACCESS, 'get_token_tranches', { token_id: tid });
    if (tranches.length !== 1 || tranches[0].gross !== '101') throw new Error(`tranche wrong after ${purchaseId}: ${JSON.stringify(tranches)}`);
    console.log(`  ok: purchase ${purchaseId} minted ${tid}`);
    return tid;
  }
  const tid1 = await purchase('tn-ord-1');

  // 7. Wait past the 10s term; trader withdraws the FULL vested amount via
  //    the REAL FT (happy path): callback receipt must show payout_settled
  //    and the OPS balance must increase by exactly the claimable amount.
  console.log('waiting 12s for the term to end…');
  await sleep(12_000);
  const claimable = BigInt(await callView(ACCESS, 'claimable_of', { trader_id: OPS }));
  if (claimable !== 101n) throw new Error(`claimable after full term expected 101, got ${claimable}`);
  snapshotFt(OPS, await ftBalanceOf(OPS));
  snapshotFt(ACCESS, await ftBalanceOf(ACCESS));
  const w = await runTx(OPS, (a) =>
    a.functionCall({ contractId: ACCESS, methodName: 'ft_withdraw', args: { amount: null }, attachedDeposit: 1n, gas: 250n * 10n ** 12n }),
  );
  const settled = (w.receipts ?? []).some((r) =>
    (r.outcome?.logs ?? []).some((l) => l.includes('payout_settled')),
  );
  if (!settled) throw new Error('payout_settled log not found in callback receipts');
  await assertFtDelta(OPS, 101n, 'withdraw payout');
  await assertFtDelta(ACCESS, -101n, 'withdraw payout');
  if ((await callView(ACCESS, 'claimable_of', { trader_id: OPS })) !== '0') {
    throw new Error('claimable must be 0 after a fully settled withdraw');
  }
  console.log('  ok: withdraw happy path settled on-chain');

  // 8. Purchase #2, terminated mid-term; the refund MUST be positive.
  const tid2 = await purchase('tn-ord-2');
  await runTx(MONITOR, (a) =>
    a.functionCall({ contractId: ACCESS, methodName: 'terminate_service', args: { trader_id: OPS, reason: 'smoke termination' }, gas: GAS }),
  );
  const refundable = BigInt(await callView(ACCESS, 'refundable_of', { token_id: tid2 }));
  if (refundable <= 0n) {
    throw new Error(`refund must be POSITIVE after a mid-term termination; got ${refundable} (test scenario is invalid, failing loudly)`);
  }
  console.log(`  ok: positive refund ${refundable}`);
  snapshotFt(BUYER, await ftBalanceOf(BUYER));
  snapshotFt(ACCESS, await ftBalanceOf(ACCESS));
  await runTx(BUYER, (a) =>
    a.functionCall({ contractId: ACCESS, methodName: 'claim_refund', args: { token_id: tid2 }, attachedDeposit: 1n, gas: 250n * 10n ** 12n }),
  );
  await assertFtDelta(BUYER, refundable, 'refund payout');
  await assertFtDelta(ACCESS, -refundable, 'refund payout');
  if ((await callView(ACCESS, 'refundable_of', { token_id: tid2 })) !== '0') {
    throw new Error('refundable must be 0 after a settled refund claim');
  }
  console.log('  ok: refund happy path settled on-chain');

  console.log('SMOKE DONE — all assertions passed');
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err.message ?? err);
  process.exit(1);
});
