// Deterministic health, freshness and copy-eligibility rules (KF-D001, KF-D002).
// Pure functions: no clocks, network or process access; callers pass times.
//
// Two distinct time dimensions are intentionally kept separate:
//  * SOURCE_FRESHNESS_MS (120s, D11) — a single observation is "fresh" only
//    within this window; anything older is STALE, even if it is far inside the
//    24h outage window.
//  * OUTAGE_THRESHOLD_MS (24h, D001) — service termination is gated on
//    continuous inability to obtain usable data, never on trade inactivity.

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** D11 default stale/freshness threshold: a read older than this is stale, not healthy. */
export const SOURCE_FRESHNESS_MS = 120_000;

/** D001 24-hour monitor default: continuous inability to obtain usable data. */
export const OUTAGE_THRESHOLD_MS = 24 * HOUR_MS;

/** Assisted copy: trusted source execution/confirmation time at most 5 minutes old (KF-D002). */
export const COPY_MAX_AGE_MS = 5 * MINUTE_MS;

export type ObservationQuality =
  | 'usable'
  | 'valid_empty'
  | 'unknown'
  | 'incomplete'
  | 'auth_error';

/**
 * Only a real, usable read counts as a successful observation. A valid empty
 * history page IS a successful read (an idle account is healthy); unknown,
 * incomplete or auth-error responses never masquerade as a successful empty read.
 */
export function countsAsSuccessfulRead(quality: ObservationQuality): boolean {
  return quality === 'usable' || quality === 'valid_empty';
}

export type EpochValidationResult =
  | { ok: true; value: number }
  | { ok: false; reason: string };

/**
 * Millisecond timestamps must be finite, nonnegative, safe integers. NaN,
 * ±Infinity, negatives, fractional values and values above Number.MAX_SAFE_INTEGER
 * are rejected. This is the fail-closed boundary shared by copy, health, freshness
 * and outage rules.
 */
export function validateEpochMs(value: unknown): EpochValidationResult {
  if (typeof value !== 'number') {
    return { ok: false, reason: 'timestamp must be a number of milliseconds' };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, reason: 'timestamp must be finite (NaN/Infinity are rejected)' };
  }
  if (value < 0) {
    return { ok: false, reason: 'timestamp must be nonnegative' };
  }
  if (!Number.isSafeInteger(value)) {
    return { ok: false, reason: 'timestamp must be a safe integer number of milliseconds' };
  }
  return { ok: true, value };
}

export interface ReadHealthInput {
  /** Timestamp (ms) of the last usable/valid observation. */
  lastUsableAt: number | null;
  /** Current time (ms). */
  now: number;
  /** Optional freshness override; defaults to SOURCE_FRESHNESS_MS (120s). */
  freshnessMs?: number;
}

/**
 * A readable account is healthy only while its last usable observation is
 * FRESH (within SOURCE_FRESHNESS_MS) and not in the future. A 23h-old read is
 * therefore stale (not healthy). Out-of-order, invalid or future timestamps
 * fail closed to `false`. This is the freshness dimension; the 24h outage
 * dimension is modelled separately by applyObservation/outageDurationMs.
 */
export function isReadableIdleHealthy(input: ReadHealthInput): boolean {
  if (input.lastUsableAt === null) return false;
  const now = validateEpochMs(input.now);
  if (!now.ok) return false;
  const last = validateEpochMs(input.lastUsableAt);
  if (!last.ok) return false;
  if (last.value > now.value) return false; // future or out-of-order observation
  const freshness = validateEpochMs(input.freshnessMs ?? SOURCE_FRESHNESS_MS);
  if (!freshness.ok) return false;
  return now.value - last.value <= freshness.value;
}

export interface OutageState {
  /** When continuous unusable reads started, or null when healthy. */
  outageStartedAt: number | null;
  /** Last usable/valid observation timestamp, or null before any successful read. */
  lastUsableAt: number | null;
  /** Wall-clock time of the most recent (in-order) observation attempt. */
  now: number;
}

export function initialOutageState(now: number): OutageState {
  return { outageStartedAt: null, lastUsableAt: null, now };
}

/**
 * Fold one observation into the outage accumulator. Successful reads clear an
 * ongoing outage and refresh lastUsableAt; unsuccessful reads (unknown,
 * incomplete, auth_error) open or extend the outage and NEVER reset lastUsableAt.
 * A valid empty page is a successful read and resets the outage.
 *
 * Invalid timestamps (NaN/Infinity/negative/fractional/unsafe) and out-of-order
 * observations (at < state.now) are IGNORED: they advance no state, so a bad or
 * backfilled observation can neither open nor clear an outage.
 */
export function applyObservation(state: OutageState, quality: ObservationQuality, at: number): OutageState {
  const validated = validateEpochMs(at);
  if (!validated.ok) return state; // ignore invalid timestamp
  if (validated.value < state.now) return state; // ignore out-of-order/backfill
  if (countsAsSuccessfulRead(quality)) {
    return { outageStartedAt: null, lastUsableAt: validated.value, now: validated.value };
  }
  const outageStartedAt = state.outageStartedAt ?? validated.value;
  return { outageStartedAt, lastUsableAt: state.lastUsableAt, now: validated.value };
}

/** Milliseconds since the outage started (0 when healthy/out-of-order or invalid). */
export function outageDurationMs(state: OutageState, now: number): number {
  const validated = validateEpochMs(now);
  if (!validated.ok) return 0;
  if (state.outageStartedAt === null) return 0;
  if (validated.value < state.outageStartedAt) return 0;
  return validated.value - state.outageStartedAt;
}

/** True once the continuous outage has reached (>=) the threshold; 24h default. */
export function isInOutage(state: OutageState, now: number, thresholdMs: number = OUTAGE_THRESHOLD_MS): boolean {
  const threshold = validateEpochMs(thresholdMs);
  if (!threshold.ok) return false; // invalid threshold -> never eligible
  const nowValid = validateEpochMs(now);
  if (!nowValid.ok) return false; // invalid now -> never eligible
  if (state.outageStartedAt === null) return false; // no outage -> never eligible (even threshold 0)
  const started = validateEpochMs(state.outageStartedAt);
  if (!started.ok) return false; // invalid state -> never eligible
  if (nowValid.value < started.value) return false; // out-of-order now -> never eligible
  return nowValid.value - started.value >= threshold.value;
}

export type CopyReason =
  | 'eligible'
  | 'not_confirmed'
  | 'missing_timestamp'
  | 'invalid_timestamp'
  | 'future_timestamp'
  | 'too_old';

export type CopyVerdict =
  | { eligible: true; reason: 'eligible' }
  | { eligible: false; reason: Exclude<CopyReason, 'eligible'> };

export interface CopyCandidateInput {
  /** The source trade is a confirmed spot swap. */
  confirmed: boolean;
  /** Trusted source execution/confirmation timestamp (ms), or null when missing/unknown. */
  sourceExecutionAtMs: number | null;
  /** Current server time (ms). */
  nowMs: number;
}

/**
 * Assisted-copy eligibility (KF-D002). Always measures age from the trusted
 * source execution/confirmation time — NEVER from discovery (observed_at), so a
 * backfilled trade discovered now but executed long ago is denied and repeated
 * observation cannot rejuvenate it. NaN/Infinity/negative/fractional/unsafe
 * timestamps are rejected (`invalid_timestamp`); future timestamps are denied.
 */
export function evaluateCopyEligibility(input: CopyCandidateInput): CopyVerdict {
  if (!input.confirmed) return { eligible: false, reason: 'not_confirmed' };
  if (input.sourceExecutionAtMs === null) return { eligible: false, reason: 'missing_timestamp' };
  const now = validateEpochMs(input.nowMs);
  if (!now.ok) return { eligible: false, reason: 'invalid_timestamp' };
  const source = validateEpochMs(input.sourceExecutionAtMs);
  if (!source.ok) return { eligible: false, reason: 'invalid_timestamp' };
  if (source.value > now.value) return { eligible: false, reason: 'future_timestamp' };
  const age = now.value - source.value;
  if (age > COPY_MAX_AGE_MS) return { eligible: false, reason: 'too_old' };
  return { eligible: true, reason: 'eligible' };
}