// Purchase lifecycle state machine + stable-id persistence (KF-08b). A wallet
// "success" is NOT a license: the flow only reaches `confirmed` after the
// contract `has_purchase` view returns true AND the derived license owner
// matches the buyer. The purchase_id and its bound payload are persisted in
// browser storage so a reload/retry recovers the SAME id instead of minting a
// fresh one after an ambiguous result. Pure logic — no React, no wallet calls,
// no signing. Synthetic wallet results are tested in apps/web/test.

export type PurchasePhase =
  | 'idle'
  | 'awaiting-wallet'
  | 'submitted'
  | 'pending-unknown'
  | 'confirmed'
  | 'failed';

export interface PurchasePayload {
  network: 'testnet';
  accessContract: string;
  ftContract: string;
  traderId: string;
  planVersion: number;
  /** Canonical atomic price string (exact; never a float). */
  priceAtomic: string;
  buyer: string;
  purchaseId: string;
}

export interface PurchaseState {
  phase: PurchasePhase;
  payload: PurchasePayload | null;
  txHash: string | null;
  reason: string | null;
  /** true only for wallet cancellation/error — distinct from an on-chain refund. */
  rejectedByWallet: boolean;
}

export interface PurchaseRecord {
  payload: PurchasePayload;
  createdAtMs: number;
  txHash: string | null;
  phase: PurchasePhase;
}

export interface PurchaseStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const noopStorage: PurchaseStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** Browser localStorage adapter; safe to construct in SSR (no window access until called). */
export const localStorageAdapter: PurchaseStorage = {
  getItem: (key) => {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch {
      /* storage quota/disabled: recovery degrades to in-memory only */
    }
  },
  removeItem: (key) => {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function purchaseStorageKey(
  network: string,
  accessContract: string,
  traderId: string,
  buyer: string,
): string {
  return `keyfolio:purchase:${network}:${accessContract}:${traderId}:${buyer}`;
}

/** Token id the ACCESS contract derives: `kf-{trader}-{buyer}-{purchaseId}`. */
export function deriveTokenId(payload: PurchasePayload): string {
  return `kf-${payload.traderId}-${payload.buyer}-${payload.purchaseId}`;
}

export function newPurchaseId(now: number = Date.now()): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `web-${now}-${rand}`;
}

export function initialPurchaseState(): PurchaseState {
  return { phase: 'idle', payload: null, txHash: null, reason: null, rejectedByWallet: false };
}

export function loadPurchaseRecord(storage: PurchaseStorage, key: string): PurchaseRecord | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { payload?: unknown }).payload === 'object' &&
      (parsed as { payload?: { purchaseId?: unknown } }).payload !== null &&
      typeof ((parsed as { payload: { purchaseId?: unknown } }).payload).purchaseId === 'string'
    ) {
      return parsed as PurchaseRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export function persistPurchaseRecord(storage: PurchaseStorage, key: string, record: PurchaseRecord): void {
  storage.setItem(key, JSON.stringify(record));
}

export function recordFromState(state: PurchaseState, createdAtMs: number): PurchaseRecord | null {
  if (!state.payload) return null;
  return {
    payload: state.payload,
    createdAtMs,
    txHash: state.txHash,
    phase: state.phase,
  };
}

export interface ResolvePayloadCtx {
  network: 'testnet';
  accessContract: string;
  ftContract: string;
  traderId: string;
  planVersion: number;
  priceAtomic: string;
  buyer: string;
}

/**
 * Resolution of a purchase intent for the current binding. `new` is the only
 * state that may start a purchase; `blocked` means an earlier attempt for this
 * buyer+trader binding is unresolved or already confirmed and must be
 * recovered (or acknowledged) before any new purchase_id is minted.
 */
export type PayloadResolution =
  | { kind: 'new'; payload: PurchasePayload }
  | { kind: 'blocked'; record: PurchaseRecord; reason: string };

/**
 * Returns the payload to submit. A persisted UNRESOLVED attempt (awaiting,
 * submitted, pending-unknown) for the SAME buyer+trader blocks a new intent
 * even if the plan/price changed — the old id must be recovered first, never
 * silently re-minted. A persisted `confirmed` attempt also blocks (no
 * re-purchase of the same license through this flow). A definitively `failed`
 * attempt (explicit rejection or a reverted tx) allows a clean new intent.
 */
export function resolveOrCreatePayload(
  ctx: ResolvePayloadCtx,
  storage: PurchaseStorage,
  newId: (now: number) => string = newPurchaseId,
  now: number = Date.now(),
): PayloadResolution {
  const key = purchaseStorageKey(ctx.network, ctx.accessContract, ctx.traderId, ctx.buyer);
  const existing = loadPurchaseRecord(storage, key);
  if (existing) {
    const unresolved =
      existing.phase === 'awaiting-wallet' ||
      existing.phase === 'submitted' ||
      existing.phase === 'pending-unknown';
    if (unresolved) {
      return {
        kind: 'blocked',
        record: existing,
        reason: 'A previous purchase is still pending — recover it before starting a new one.',
      };
    }
    if (existing.phase === 'confirmed') {
      return { kind: 'blocked', record: existing, reason: 'This purchase is already confirmed.' };
    }
    // 'failed' (definitive) or legacy 'idle': clean new intent below.
  }
  return {
    kind: 'new',
    payload: {
      network: ctx.network,
      accessContract: ctx.accessContract,
      ftContract: ctx.ftContract,
      traderId: ctx.traderId,
      planVersion: ctx.planVersion,
      priceAtomic: ctx.priceAtomic,
      buyer: ctx.buyer,
      purchaseId: newId(now),
    },
  };
}

/** True only when the payload identity matches the current checkout binding. */
export function payloadMatchesBinding(
  payload: PurchasePayload,
  binding: { network: string; accessContract: string; traderId: string; buyer: string },
): boolean {
  return (
    payload.network === binding.network &&
    payload.accessContract === binding.accessContract &&
    payload.traderId === binding.traderId &&
    payload.buyer === binding.buyer
  );
}

/**
 * Restore the persisted purchase for a binding (network/access/trader/buyer),
 * validating the saved payload against that binding. This is the pure seam the
 * React effect calls once the wallet account resolves asynchronously; a
 * mismatched or absent record yields the idle state.
 */
export function restorePurchase(
  storage: PurchaseStorage,
  binding: { network: string; accessContract: string; traderId: string; buyer: string },
): PurchaseState {
  const key = purchaseStorageKey(binding.network, binding.accessContract, binding.traderId, binding.buyer);
  const record = loadPurchaseRecord(storage, key);
  if (!record || !payloadMatchesBinding(record.payload, binding)) return initialPurchaseState();
  return stateFromRecord(record);
}

export type WalletOutcome =
  | { kind: 'signed'; txHash: string | null; txFailed: boolean }
  | { kind: 'no-result' };

/**
 * Classify a Wallet Selector `signAndSendTransaction` resolution. It resolves
 * to `FinalExecutionOutcome | void`: undefined/null is a redirect with no
 * result. A resolved object whose `status.Failure` is set reverted on chain;
 * otherwise it is a submitted (but NOT yet license-verified) transaction.
 */
export function classifyWalletResult(result: unknown): WalletOutcome {
  if (result === null || result === undefined) {
    return { kind: 'no-result' };
  }
  const r = result as {
    status?: { Failure?: unknown; SuccessValue?: string; SuccessReceiptId?: string };
    transaction_outcome?: { id?: string };
  };
  return {
    kind: 'signed',
    txHash: r.transaction_outcome?.id ?? null,
    txFailed: !!r.status?.Failure,
  };
}

export function beginPurchase(prev: PurchaseState, payload: PurchasePayload): PurchaseState {
  return { ...prev, phase: 'awaiting-wallet', payload, txHash: null, reason: null, rejectedByWallet: false };
}

export function applyWalletOutcome(prev: PurchaseState, outcome: WalletOutcome): PurchaseState {
  if (outcome.kind === 'no-result') {
    return {
      ...prev,
      phase: 'pending-unknown',
      txHash: null,
      reason: 'Wallet returned without a result (redirect). Recovery pending — do not resubmit blindly.',
      rejectedByWallet: false,
    };
  }
  if (outcome.txFailed) {
    return {
      ...prev,
      phase: 'failed',
      txHash: outcome.txHash,
      reason: 'Transaction reverted on chain (ft_transfer_call failed). No license minted.',
      rejectedByWallet: false,
    };
  }
  return {
    ...prev,
    phase: 'submitted',
    txHash: outcome.txHash,
    reason: 'Submitted — awaiting on-chain license verification.',
    rejectedByWallet: false,
  };
}

/** Known USER-anchored rejection types (tight set, not generic transport codes). */
const USER_REJECTION_TYPES = new Set([
  'userrejected',
  'userrejectederror',
  'rejectedbyuser',
  'rejectedbyusererror',
  'userdenied',
  'usercancelled',
  'userrefused',
]);

/** Tight USER-anchored wording: "user rejected"/"user cancelled"/… only. */
const USER_REJECTION_MSG = /\buser\s+(rejected|cancelled|denied|declined|refused)\b/i;

/**
 * Conservative detection of an EXPLICIT user rejection — NOT a generic
 * transport/provider failure. "connection refused", "access denied" or
 * "provider … denied" are system/provider conditions and stay ambiguous
 * (pending-unknown), never a definitive user cancellation.
 */
export function isExplicitRejection(err: unknown): boolean {
  if (!err) return false;
  const type = String((err as { type?: unknown } | null)?.type ?? '').trim().toLowerCase();
  if (type && USER_REJECTION_TYPES.has(type)) return true;
  const message = String((err as { message?: unknown } | null)?.message ?? (typeof err === 'string' ? err : '')).toLowerCase();
  return USER_REJECTION_MSG.test(message);
}

/**
 * Only a KNOWN explicit user rejection is definitive `failed` (and thus
 * retryable). Any other thrown error — transport, timeout, provider — is an
 * AMBIGUOUS outcome: the transaction may have been submitted, so the flow
 * stays `pending-unknown` with the same id and no blind resubmit.
 */
export function applyWalletError(prev: PurchaseState, err: unknown): PurchaseState {
  const message = String((err as { message?: unknown } | null)?.message ?? err ?? '').slice(0, 240);
  if (isExplicitRejection(err)) {
    return { ...prev, phase: 'failed', reason: 'User rejected the transaction.', rejectedByWallet: true };
  }
  return {
    ...prev,
    phase: 'pending-unknown',
    reason: message || 'Submission error — recovery pending, do not resubmit blindly.',
    rejectedByWallet: false,
  };
}

/**
 * Verify final license state. `confirmed` requires the contract receipt AND the
 * correct binding; a public `has_purchase` read or owner read is never treated
 * as a private entitlement/auth proof — the caller still enforces its own
 * access rules. A false read after submission stays pending-unknown (recovery),
 * never a boolean "no".
 */
export function applyVerification(
  prev: PurchaseState,
  hasPurchase: boolean,
  licenseOwner: string | null,
): PurchaseState {
  if (!hasPurchase) {
    return { ...prev, phase: 'pending-unknown', reason: 'License not found yet — recovery pending.' };
  }
  if (prev.payload && licenseOwner === prev.payload.buyer) {
    return { ...prev, phase: 'confirmed', reason: null };
  }
  return {
    ...prev,
    phase: 'failed',
    reason: 'License owner does not match the buyer (binding failed).',
    rejectedByWallet: false,
  };
}

/** Restore UI state from a persisted record on reload. */
export function stateFromRecord(record: PurchaseRecord | null): PurchaseState {
  if (!record) return initialPurchaseState();
  const phase =
    record.phase === 'confirmed' || record.phase === 'failed'
      ? record.phase
      : record.txHash
        ? 'submitted'
        : 'pending-unknown';
  return {
    phase,
    payload: record.payload,
    txHash: record.txHash,
    reason: record.phase === 'failed' ? 'Previous attempt failed.' : null,
    rejectedByWallet: false,
  };
}

/** True when a new submission must be blocked pending definitive recovery. */
export function blocksResubmit(state: PurchaseState): boolean {
  return state.phase === 'submitted' || state.phase === 'pending-unknown' || state.phase === 'awaiting-wallet';
}

/** True when the "buy" action may be offered: only a clean idle or a
 *  definitively-failed (rejection/reverted) attempt — never unresolved or
 *  already-confirmed phases. */
export function canOfferPurchase(state: PurchaseState): boolean {
  return state.phase === 'idle' || state.phase === 'failed';
}