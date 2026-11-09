// Purchase lifecycle tests: a wallet success is NOT a license; only the
// contract receipt + correct owner binding reaches `confirmed`. An unresolved
// or confirmed attempt blocks a NEW purchase_id (no blind re-mint), explicit
// user rejection is the only definitive "failed" error, and restore-by-binding
// is the reload seam. All synthetic — no wallet, no signing, no transactions.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVerification,
  applyWalletError,
  applyWalletOutcome,
  beginPurchase,
  blocksResubmit,
  canOfferPurchase,
  classifyWalletResult,
  deriveTokenId,
  isExplicitRejection,
  loadPurchaseRecord,
  persistPurchaseRecord,
  purchaseStorageKey,
  recordFromState,
  resolveOrCreatePayload,
  restorePurchase,
  stateFromRecord,
  type PurchasePayload,
  type PurchaseState,
  type PurchaseStorage,
} from '../src/purchaseFlow';

function memoryStorage(): PurchaseStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
}

const ctx = {
  network: 'testnet' as const,
  accessContract: 'access.near',
  ftContract: 'ft.near',
  traderId: 'ops.near',
  planVersion: 1,
  priceAtomic: '101',
  buyer: 'buyer.near',
};

function idle(): PurchaseState {
  return { phase: 'idle', payload: null, txHash: null, reason: null, rejectedByWallet: false };
}

function payload(overrides: Partial<PurchasePayload> = {}): PurchasePayload {
  return { ...ctx, purchaseId: 'web-1', ...overrides };
}

function keyOf(p: PurchasePayload = payload()): string {
  return purchaseStorageKey(p.network, p.accessContract, p.traderId, p.buyer);
}

function writePending(storage: PurchaseStorage, p: PurchasePayload, phase: 'submitted' | 'pending-unknown' = 'pending-unknown') {
  persistPurchaseRecord(storage, keyOf(p), {
    payload: p,
    createdAtMs: 1000,
    txHash: phase === 'submitted' ? 'h' : null,
    phase,
  });
}

test('classifyWalletResult separates signed / reverted / no-result (redirect)', () => {
  assert.deepEqual(classifyWalletResult(undefined), { kind: 'no-result' });
  assert.deepEqual(classifyWalletResult(null), { kind: 'no-result' });
  assert.deepEqual(classifyWalletResult({}), { kind: 'signed', txHash: null, txFailed: false });
  assert.deepEqual(classifyWalletResult({ transaction_outcome: { id: 'h1' } }), {
    kind: 'signed',
    txHash: 'h1',
    txFailed: false,
  });
  assert.deepEqual(
    classifyWalletResult({ status: { Failure: { error_message: 'x' } }, transaction_outcome: { id: 'h2' } }),
    { kind: 'signed', txHash: 'h2', txFailed: true },
  );
});

test('a successful wallet outcome is `submitted`, never `confirmed`', () => {
  const started = beginPurchase(idle(), payload());
  const after = applyWalletOutcome(started, { kind: 'signed', txHash: 'h', txFailed: false });
  assert.equal(after.phase, 'submitted');
  assert.notEqual(after.phase, 'confirmed');
});

test('ambiguous redirect with no result is pending-unknown (recovery, not success)', () => {
  const started = beginPurchase(idle(), payload());
  const after = applyWalletOutcome(started, { kind: 'no-result' });
  assert.equal(after.phase, 'pending-unknown');
});

test('explicit user rejection is definitive `failed` and distinct from an on-chain refund', () => {
  const started = beginPurchase(idle(), payload());
  const after = applyWalletError(started, { message: 'User rejected the transaction' });
  assert.equal(after.phase, 'failed');
  assert.equal(after.rejectedByWallet, true);
});

test('transport/timeout/provider errors are AMBIGUOUS (`pending-unknown`), not definitive failure', () => {
  const started = beginPurchase(idle(), payload());
  for (const err of [{ message: 'ETIMEDOUT' }, new Error('fetch failed'), 'network down', {}]) {
    const after = applyWalletError(started, err);
    assert.equal(after.phase, 'pending-unknown', JSON.stringify(err));
    assert.equal(after.rejectedByWallet, false);
  }
  // typed rejection still detected as definitive even without a message
  const afterType = applyWalletError(started, { type: 'UserRejected' });
  assert.equal(afterType.phase, 'failed');
  assert.equal(afterType.rejectedByWallet, true);
});

test('regression: generic "connection refused" and "access denied" are NOT user rejections', () => {
  const started = beginPurchase(idle(), payload());
  const cases: unknown[] = [
    { message: 'RPC connection refused' },
    { message: 'Provider access denied' },
    { message: 'connect ECONNREFUSED 127.0.0.1' },
    { message: 'request refused by server' },
  ];
  for (const err of cases) {
    assert.equal(isExplicitRejection(err), false, JSON.stringify(err));
    const after = applyWalletError(started, err);
    assert.equal(after.phase, 'pending-unknown', JSON.stringify(err));
    assert.equal(after.rejectedByWallet, false);
  }
});

test('reverted transaction is `failed` (no license)', () => {
  const started = beginPurchase(idle(), payload());
  const after = applyWalletOutcome(started, { kind: 'signed', txHash: 'h', txFailed: true });
  assert.equal(after.phase, 'failed');
  assert.equal(after.rejectedByWallet, false);
});

test('confirmation requires has_purchase AND the buyer as license owner (no always-true auth)', () => {
  const started = beginPurchase(idle(), payload({ buyer: 'buyer.near' }));
  assert.equal(applyVerification(started, false, null).phase, 'pending-unknown');
  assert.equal(applyVerification(started, true, 'someone-else.near').phase, 'failed');
  assert.equal(applyVerification(started, true, 'buyer.near').phase, 'confirmed');
});

test('a persisted UNRESOLVED attempt blocks a new purchase_id (stable id across reload)', () => {
  const storage = memoryStorage();
  const first = resolveOrCreatePayload(ctx, storage, () => 'web-A', 1);
  assert.equal(first.kind, 'new');
  const p = (first as { kind: 'new'; payload: PurchasePayload }).payload;
  writePending(storage, p, 'pending-unknown');

  // Reload: same binding -> blocked with the SAME id (never a fresh id).
  const second = resolveOrCreatePayload(ctx, storage, () => 'web-B', 2);
  assert.equal(second.kind, 'blocked');
  assert.equal((second as { record: { payload: PurchasePayload } }).record.payload.purchaseId, p.purchaseId);
});

test('persisted pending + changed plan/price is still BLOCKED (no fresh id while unresolved)', () => {
  const storage = memoryStorage();
  writePending(storage, payload({ planVersion: 1, priceAtomic: '101' }), 'pending-unknown');
  const res = resolveOrCreatePayload(
    { ...ctx, planVersion: 2, priceAtomic: '202' },
    storage,
    () => 'web-NEW',
    3,
  );
  assert.equal(res.kind, 'blocked');
  assert.equal((res as { record: { payload: PurchasePayload } }).record.payload.purchaseId, 'web-1');
});

test('a persisted CONFIRMED attempt blocks re-purchase', () => {
  const storage = memoryStorage();
  persistPurchaseRecord(storage, keyOf(), { payload: payload(), createdAtMs: 1, txHash: 'h', phase: 'confirmed' });
  const res = resolveOrCreatePayload(ctx, storage, () => 'web-NEW', 1);
  assert.equal(res.kind, 'blocked');
  assert.equal((res as { record: { phase: string } }).record.phase, 'confirmed');
});

test('a definitively failed attempt allows a clean NEW intent (fresh id)', () => {
  const storage = memoryStorage();
  persistPurchaseRecord(storage, keyOf(), { payload: payload(), createdAtMs: 1, txHash: 'h', phase: 'failed' });
  const res = resolveOrCreatePayload(ctx, storage, () => 'web-NEW', 1);
  assert.equal(res.kind, 'new');
});

test('canOfferPurchase: only idle and failed offer purchase; unresolved/confirmed do not', () => {
  const withPayload = { ...idle(), payload: payload() };
  assert.equal(canOfferPurchase(idle()), true);
  assert.equal(canOfferPurchase({ ...withPayload, phase: 'failed' }), true);
  assert.equal(canOfferPurchase({ ...withPayload, phase: 'submitted' }), false);
  assert.equal(canOfferPurchase({ ...withPayload, phase: 'pending-unknown' }), false);
  assert.equal(canOfferPurchase({ ...withPayload, phase: 'awaiting-wallet' }), false);
  assert.equal(canOfferPurchase({ ...withPayload, phase: 'confirmed' }), false);
});

test('restorePurchase is the async-account restore seam: no account -> idle, resolved account -> pending', () => {
  const storage = memoryStorage();
  writePending(storage, payload(), 'pending-unknown');

  const none = restorePurchase(storage, { network: 'testnet', accessContract: 'access.near', traderId: 'ops.near', buyer: '' });
  assert.equal(none.phase, 'idle');

  const restored = restorePurchase(storage, { network: 'testnet', accessContract: 'access.near', traderId: 'ops.near', buyer: 'buyer.near' });
  assert.equal(restored.phase, 'pending-unknown');
  assert.equal(restored.payload?.purchaseId, 'web-1');

  const wrongBinding = restorePurchase(storage, { network: 'testnet', accessContract: 'other.near', traderId: 'ops.near', buyer: 'buyer.near' });
  assert.equal(wrongBinding.phase, 'idle');
});

test('deriveTokenId matches the contract kf-{trader}-{buyer}-{purchaseId} scheme', () => {
  assert.equal(deriveTokenId(payload()), 'kf-ops.near-buyer.near-web-1');
});

test('blocksResubmit only during unresolved phases', () => {
  const base = { payload: payload(), txHash: null, reason: null, rejectedByWallet: false };
  assert.equal(blocksResubmit({ ...base, phase: 'awaiting-wallet' }), true);
  assert.equal(blocksResubmit({ ...base, phase: 'submitted' }), true);
  assert.equal(blocksResubmit({ ...base, phase: 'pending-unknown' }), true);
  assert.equal(blocksResubmit({ ...base, phase: 'failed' }), false);
  assert.equal(blocksResubmit({ ...base, phase: 'confirmed' }), false);
  assert.equal(blocksResubmit({ ...base, phase: 'idle' }), false);
});

test('stateFromRecord restores a persisted unresolved purchase for recovery', () => {
  const storage = memoryStorage();
  const key = 'kf';
  persistPurchaseRecord(storage, key, { payload: payload(), createdAtMs: 1000, txHash: 'h', phase: 'submitted' });
  const restored = stateFromRecord(loadPurchaseRecord(storage, key));
  assert.equal(restored.phase, 'submitted');
  assert.equal(restored.payload?.purchaseId, 'web-1');

  const ambiguous = stateFromRecord({ payload: payload(), createdAtMs: 1000, txHash: null, phase: 'pending-unknown' });
  assert.equal(ambiguous.phase, 'pending-unknown');
});