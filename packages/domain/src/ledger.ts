// Pure ledger rules (baseline 01 section 7; acceptance L01/L03/L04/L05/L07 at
// domain level; L02/L06 are persistence/cursor concerns owned by the worker
// tasks). No clocks, env, database or I/O: callers pass validated data. Only
// source-CONFIRMED economic effects enter balances; corrections reverse their
// target exactly once; unknown movement kinds quarantine instead of becoming
// profit. All amounts are canonical atomic strings with bigint arithmetic.

import { parseAtomicAmount, parseSignedAtomicDelta } from './amount.js';

export const LEDGER_EVENT_TYPES = [
  'DEPOSIT',
  'WITHDRAWAL',
  'SWAP',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'REFUND',
  'FEE',
  'CORRECTION',
] as const;
export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];

export const LEDGER_EVENT_STATUSES = [
  'OBSERVED',
  'PENDING',
  'CONFIRMED',
  'FAILED',
  'REFUNDED',
  'RECONCILIATION_REQUIRED',
] as const;
export type LedgerEventStatus = (typeof LEDGER_EVENT_STATUSES)[number];

/** Movement kinds recognized by normalization_version kf-ledger-v1. */
export const MOVEMENT_KINDS = [
  'TRADE_LEG',
  'EXTERNAL_DEPOSIT',
  'EXTERNAL_WITHDRAWAL',
  'INTERNAL_TRANSFER',
  'FEE',
  'REFUND',
] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

/** Normalization version stamped on results derived from these rules. */
export const NORMALIZATION_VERSION = 'kf-ledger-v1' as const;

/** Stable unique event identity: provider + account + source event + revision. */
export function eventKey(provider: string, sourceAccountId: string, sourceEventId: string, revision: number): string {
  for (const [name, v] of [
    ['provider', provider],
    ['sourceAccountId', sourceAccountId],
    ['sourceEventId', sourceEventId],
  ] as const) {
    if (typeof v !== 'string' || v.length === 0) {
      throw new RangeError(`${name} must be a nonempty string`);
    }
  }
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new RangeError('revision must be a safe integer >= 1');
  }
  return `${provider}\u0000${sourceAccountId}\u0000${sourceEventId}\u0000${revision}`;
}

// ---------------------------------------------------------------------------
// Status lifecycle: OBSERVED -> PENDING -> CONFIRMED | FAILED | REFUNDED.
// Unexpected regressions become RECONCILIATION_REQUIRED, never silent.
// ---------------------------------------------------------------------------

const FORWARD_TRANSITIONS: Readonly<Record<LedgerEventStatus, readonly LedgerEventStatus[]>> = {
  OBSERVED: ['PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED'],
  PENDING: ['CONFIRMED', 'FAILED', 'REFUNDED'],
  CONFIRMED: [],
  FAILED: [],
  REFUNDED: [],
  RECONCILIATION_REQUIRED: [],
};

export type StatusTransitionResult =
  | { ok: true; status: LedgerEventStatus }
  | { ok: false; status: 'RECONCILIATION_REQUIRED'; reason: string };

/**
 * Resolve one observed status update against the lifecycle. Forward or
 * identical states pass through; anything else (including CONFIRMED -> FAILED
 * or PENDING after CONFIRMED) is a regression that must be reconciled, never
 * silently applied.
 */
export function resolveStatusTransition(current: LedgerEventStatus, next: LedgerEventStatus): StatusTransitionResult {
  if (!LEDGER_EVENT_STATUSES.includes(current) || !LEDGER_EVENT_STATUSES.includes(next)) {
    return { ok: false, status: 'RECONCILIATION_REQUIRED', reason: `unknown status ${String(next)}` };
  }
  if (next === current) return { ok: true, status: current };
  if (FORWARD_TRANSITIONS[current].includes(next)) return { ok: true, status: next };
  return {
    ok: false,
    status: 'RECONCILIATION_REQUIRED',
    reason: `regression ${current} -> ${next} requires reconciliation`,
  };
}

// ---------------------------------------------------------------------------
// Movements: validated signed deltas with boundary classification (L07)
// ---------------------------------------------------------------------------

export interface Movement {
  /** Network-scoped asset identity (e.g. "mainnet:near"). */
  assetId: string;
  movementIndex: number;
  kind: MovementKind | string; // unknown kinds are allowed as input and quarantined
  signedDelta: string; // canonical signed atomic string
}

export type ValidatedMovement =
  | { ok: true; assetId: string; movementIndex: number; kind: MovementKind; knownKind: true; delta: bigint }
  | { ok: true; assetId: string; movementIndex: number; kind: string; knownKind: false; delta: bigint }
  | { ok: false; reason: string };

export function validateMovement(movement: Movement): ValidatedMovement {
  if (typeof movement.assetId !== 'string' || movement.assetId.length === 0) {
    return { ok: false, reason: 'assetId must be a nonempty string' };
  }
  if (!Number.isSafeInteger(movement.movementIndex) || movement.movementIndex < 0) {
    return { ok: false, reason: 'movementIndex must be a safe integer >= 0' };
  }
  const delta = parseSignedAtomicDelta(movement.signedDelta);
  if (!delta.ok) return { ok: false, reason: delta.reason };
  if (MOVEMENT_KINDS.includes(movement.kind as MovementKind)) {
    return { ok: true, assetId: movement.assetId, movementIndex: movement.movementIndex, kind: movement.kind as MovementKind, knownKind: true, delta: BigInt(movement.signedDelta) };
  }
  return { ok: true, assetId: movement.assetId, movementIndex: movement.movementIndex, kind: movement.kind, knownKind: false, delta: BigInt(movement.signedDelta) };
}

/**
 * External-flow aggregation (L07): only EXTERNAL_DEPOSIT/EXTERNAL_WITHDRAWAL
 * enter the external-flow totals; INTERNAL_TRANSFER movements between public
 * and private representations inside the portfolio boundary are excluded so a
 * wrapper transfer can never be counted as an external deposit twice.
 */
export function sumExternalFlows(movements: readonly ValidatedMovement[], assetId: string): { deposit: bigint; withdrawal: bigint } {
  let deposit = 0n;
  let withdrawal = 0n;
  for (const m of movements) {
    if (!m.ok || !m.knownKind || m.assetId !== assetId) continue;
    if (m.kind === 'EXTERNAL_DEPOSIT' && m.delta > 0n) deposit += m.delta;
    if (m.kind === 'EXTERNAL_WITHDRAWAL' && m.delta < 0n) withdrawal += -m.delta;
  }
  return { deposit, withdrawal };
}

// ---------------------------------------------------------------------------
// Ledger application: dedupe, confirmed-only, corrections-once, quarantine
// ---------------------------------------------------------------------------

export interface LedgerEventInput {
  provider: string;
  sourceAccountId: string;
  sourceEventId: string;
  revision: number;
  type: LedgerEventType | string;
  status: LedgerEventStatus;
  movements: readonly Movement[];
  /** For CORRECTION: the eventKey this correction supersedes. */
  supersedes?: string | null;
}

export interface AssetBalance {
  assetId: string;
  /** Canonical atomic string; never negative (see reconcile verdicts). */
  balanceAtomic: string;
}

export type ApplyEventsResult =
  | {
      complete: true;
      /** Canonical balances after applying all once-unapplied confirmed effects. */
      balances: readonly AssetBalance[];
      /** Number of events whose effects were newly applied (deduped across replays). */
      appliedCount: number;
      /** Event keys quarantined (unknown movement kind) or irreconcilable. */
      quarantined: readonly { key: string; reason: string }[];
    }
  | { complete: false; reason: string };

function addCanonical(balance: bigint, delta: bigint): bigint {
  return balance + delta;
}

function formatBalance(value: bigint): string | null {
  if (value < 0n) return null; // caller turns this into a reconciliation failure
  return value.toString();
}

/**
 * Apply events onto opening balances. Replay-safe by construction: effects
 * are keyed by the atomic unique key, so feeding the same event set twice
 * yields exactly the same balances and appliedCount=0 on the second run
 * (L01). Non-CONFIRMED events never touch balances. CORRECTION events
 * reverse the confirmed movements of their supersedes target exactly once
 * (looked up within this stream or from `supersededOriginals` supplied by the
 * caller for corrections that arrive in a later batch) and then post their
 * own movements as the corrected truth (L03). Unknown movement kinds
 * quarantine the event instead of posting effects (L04). A resulting negative
 * balance fails closed as incomplete.
 */
export function applyLedgerEvents(
  opening: readonly AssetBalance[],
  events: readonly LedgerEventInput[],
  options?: { supersededOriginals?: Readonly<Record<string, readonly Movement[]>> },
): ApplyEventsResult {
  const balances = new Map<string, bigint>();
  for (const entry of opening) {
    const parsed = parseAtomicAmount(entry.balanceAtomic);
    if (!parsed.ok) return { complete: false, reason: `opening ${entry.assetId}: ${parsed.reason}` };
    if (typeof entry.assetId !== 'string' || entry.assetId.length === 0) {
      return { complete: false, reason: 'opening assetId must be a nonempty string' };
    }
    balances.set(entry.assetId, BigInt(entry.balanceAtomic));
  }

  const seenKeys = new Set<string>();
  const postedKeys = new Set<string>();
  const reversedKeys = new Set<string>();
  const streamMovements = new Map<string, readonly ValidatedMovement[]>();
  const quarantined: { key: string; reason: string }[] = [];
  let appliedCount = 0;

  const post = (delta: bigint, assetId: string): void => {
    balances.set(assetId, addCanonical(balances.get(assetId) ?? 0n, delta));
  };

  /** Validate every movement first; post only when all are known and valid. */
  const applyMovements = (key: string, movements: readonly ValidatedMovement[]): boolean => {
    for (const m of movements) {
      if (!m.ok) {
        quarantined.push({ key, reason: m.reason });
        return false;
      }
      if (!m.knownKind) {
        quarantined.push({ key, reason: `unknown movement kind ${String(m.kind)}` });
        return false;
      }
    }
    for (const m of movements) {
      if (m.ok) post(m.delta, m.assetId);
    }
    return true;
  };

  const originalMovementsFor = (targetKey: string): readonly ValidatedMovement[] | null => {
    const inStream = streamMovements.get(targetKey);
    if (inStream !== undefined) return inStream;
    const supplied = options?.supersededOriginals?.[targetKey];
    if (supplied !== undefined) return supplied.map(validateMovement);
    return null;
  };

  for (const event of events) {
    let key: string;
    try {
      key = eventKey(event.provider, event.sourceAccountId, event.sourceEventId, event.revision);
    } catch (err) {
      return { complete: false, reason: (err as RangeError).message };
    }
    if (seenKeys.has(key)) continue; // exact replay of the same revision
    seenKeys.add(key);

    if (event.status !== 'CONFIRMED') continue; // only confirmed effects post

    if (event.type === 'CORRECTION') {
      if (typeof event.supersedes !== 'string' || event.supersedes.length === 0) {
        quarantined.push({ key, reason: 'correction without supersedes target' });
        continue;
      }
      if (reversedKeys.has(event.supersedes)) continue; // reverse once (L03)
      const original = originalMovementsFor(event.supersedes);
      if (original === null) {
        quarantined.push({ key, reason: `correction target ${event.supersedes} not found: reconciliation required` });
        continue;
      }
      const reversed = original.map((m) =>
        m.ok ? { ...m, delta: -m.delta } : m,
      ) as ValidatedMovement[];
      if (!applyMovements(key, reversed)) continue;
      reversedKeys.add(event.supersedes);
      // The correction's own movements are the corrected truth.
      const validated = event.movements.map(validateMovement);
      if (!applyMovements(key, validated)) continue;
      streamMovements.set(key, validated);
      appliedCount += 1;
      continue;
    }

    const validated = event.movements.map(validateMovement);
    if (!applyMovements(key, validated)) continue;
    streamMovements.set(key, validated);
    postedKeys.add(key);
    appliedCount += 1;
  }

  const out: AssetBalance[] = [];
  for (const [assetId, value] of balances) {
    const formatted = formatBalance(value);
    if (formatted === null) {
      return { complete: false, reason: `asset ${assetId}: resulting balance would be negative` };
    }
    out.push({ assetId, balanceAtomic: formatted });
  }
  out.sort((a, b) => (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0));
  return { complete: true, balances: out, appliedCount, quarantined };
}

// ---------------------------------------------------------------------------
// Reconciliation: aligned opening + confirmed movements == closing (L05)
// ---------------------------------------------------------------------------

export interface ReconciliationInput {
  opening: readonly AssetBalance[];
  closing: readonly AssetBalance[];
  /** Confirmed movement deltas per asset (already validated bigints). */
  confirmedDeltas: readonly { assetId: string; delta: bigint }[];
}

export type ReconciliationResult =
  | { complete: true; balanced: true }
  | { complete: true; balanced: false; mismatches: readonly { assetId: string; expectedAtomic: string; observedAtomic: string; differenceAtomic: string }[] }
  | { complete: false; reason: string };

/**
 * Compare aligned boundaries: for each asset, opening + sum(confirmed deltas)
 * must equal the observed closing balance exactly. Assets appearing on only
 * one side are compared against an implicit zero opening/closing. Any
 * unexplained atomic difference is reported with its exact amount.
 */
export function reconcileBalances(input: ReconciliationInput): ReconciliationResult {
  const expected = new Map<string, bigint>();
  for (const entry of input.opening) {
    const parsed = parseAtomicAmount(entry.balanceAtomic);
    if (!parsed.ok) return { complete: false, reason: `opening ${entry.assetId}: ${parsed.reason}` };
    expected.set(entry.assetId, BigInt(entry.balanceAtomic));
  }
  for (const { assetId, delta } of input.confirmedDeltas) {
    if (typeof assetId !== 'string' || assetId.length === 0) {
      return { complete: false, reason: 'confirmed delta assetId must be nonempty' };
    }
    expected.set(assetId, (expected.get(assetId) ?? 0n) + delta);
  }

  const observed = new Map<string, bigint>();
  for (const entry of input.closing) {
    const parsed = parseAtomicAmount(entry.balanceAtomic);
    if (!parsed.ok) return { complete: false, reason: `closing ${entry.assetId}: ${parsed.reason}` };
    observed.set(entry.assetId, BigInt(entry.balanceAtomic));
  }

  const mismatches: { assetId: string; expectedAtomic: string; observedAtomic: string; differenceAtomic: string }[] = [];
  const assetIds = new Set<string>([...expected.keys(), ...observed.keys()]);
  for (const assetId of assetIds) {
    const exp = expected.get(assetId) ?? 0n;
    const obs = observed.get(assetId) ?? 0n;
    if (exp !== obs) {
      mismatches.push({
        assetId,
        expectedAtomic: exp.toString(),
        observedAtomic: obs.toString(),
        differenceAtomic: (obs - exp).toString(),
      });
    }
  }
  if (mismatches.length > 0) return { complete: true, balanced: false, mismatches };
  return { complete: true, balanced: true };
}
