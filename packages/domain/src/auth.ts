// Pure authentication and credential-policy rules (baseline 01 section 11;
// acceptance A01-A06 domain-level parts). No clocks, env, node or browser
// APIs: callers pass times and inject randomness/hashing on the server. The
// real signature verification standard (NEP-413/wallet) is selected in G04;
// this module owns binding, single-use and quota semantics only.

import { DAY_MS, MINUTE_MS, validateEpochMs } from './health.js';
import { parseNetwork, type KnownNetwork } from './network.js';

export const LOGIN_INTENT = 'keyfolio_login' as const;
export const NONCE_BYTES = 32;
export const CHALLENGE_TTL_MS = 5 * MINUTE_MS;
export const SESSION_TTL_MS = 15 * MINUTE_MS;
export const CREDENTIAL_MAX_LIFETIME_MS = 7 * DAY_MS;
export const CREDENTIALS_PER_LICENSE_MAX = 5;
export const QUOTA_PER_MINUTE = 60;
export const QUOTA_BURST = 10;

/** NEAR account id: lowercase segments of [a-z0-9] with -/_ inside, dot separators. */
export const NEAR_ACCOUNT_RE = /^(([a-z0-9]+[-_]?)*[a-z0-9])(\.(([a-z0-9]+[-_]?)*[a-z0-9]))*$/;

export type RuleResult = { ok: true } | { ok: false; reason: string };

function accountValid(accountId: string): boolean {
  return (
    typeof accountId === 'string' &&
    accountId.length >= 2 &&
    accountId.length <= 64 &&
    accountId === accountId.toLowerCase() &&
    NEAR_ACCOUNT_RE.test(accountId)
  );
}

// ---------------------------------------------------------------------------
// Login challenge: domain/network/account-bound, single-use (A01, A02)
// ---------------------------------------------------------------------------

export interface LoginChallengeParts {
  domain: string;
  network: KnownNetwork;
  accountId: string;
  /** 32 bytes of server entropy, hex-encoded (64 chars). */
  nonceHex: string;
  challengeId: string;
  issuedAtMs: number;
}

/** Deterministic canonical message that the wallet signs. */
export function buildLoginChallengeMessage(parts: LoginChallengeParts): string {
  const lines = [
    `domain: ${parts.domain}`,
    `network: ${parts.network}`,
    `account: ${parts.accountId}`,
    `intent: ${LOGIN_INTENT}`,
    `challenge_id: ${parts.challengeId}`,
    `nonce: ${parts.nonceHex}`,
    `issued_at: ${parts.issuedAtMs}`,
    `expires_at: ${parts.issuedAtMs + CHALLENGE_TTL_MS}`,
  ];
  return lines.join('\n');
}

export type ChallengeValidation =
  | { ok: true; expiresAtMs: number }
  | { ok: false; reason: string };

/**
 * Validate a challenge at issuance time and again at verification time. Wrong
 * domain/account/network, malformed nonce, expired window and TTL tampering
 * are all rejected before any signature is consulted.
 */
export function validateLoginChallenge(
  parts: LoginChallengeParts,
  atMs: number,
): ChallengeValidation {
  if (typeof parts.domain !== 'string' || parts.domain.length === 0 || /\s/.test(parts.domain)) {
    return { ok: false, reason: 'domain must be a nonempty string without whitespace' };
  }
  if (parseNetwork(parts.network).ok === false) {
    return { ok: false, reason: 'network must be a known network id' };
  }
  if (!accountValid(parts.accountId)) {
    return { ok: false, reason: 'accountId must be a valid NEAR account id' };
  }
  if (typeof parts.nonceHex !== 'string' || !/^[0-9a-f]{64}$/.test(parts.nonceHex)) {
    return { ok: false, reason: `nonce must be ${NONCE_BYTES} bytes as 64 lowercase hex chars` };
  }
  if (typeof parts.challengeId !== 'string' || parts.challengeId.length === 0) {
    return { ok: false, reason: 'challengeId must be a nonempty string' };
  }
  const issued = validateEpochMs(parts.issuedAtMs);
  if (!issued.ok) return { ok: false, reason: issued.reason };
  const at = validateEpochMs(atMs);
  if (!at.ok) return { ok: false, reason: at.reason };
  const expiresAtMs = parts.issuedAtMs + CHALLENGE_TTL_MS;
  if (atMs < parts.issuedAtMs) return { ok: false, reason: 'challenge not yet issued' };
  if (atMs > expiresAtMs) return { ok: false, reason: 'challenge expired' };
  return { ok: true, expiresAtMs };
}

/**
 * Single-use nonce consumption (A01). Pure core of the atomic DB consumption:
 * a nonce hash present in the store is rejected for ANY later verification,
 * so replay and simultaneous reuse cannot both succeed. The store lives in
 * PostgreSQL; the atomicity guarantee is the database's, this rule is the
 * policy.
 */
export function consumeNonce(
  consumedHashes: ReadonlySet<string>,
  nonceHash: string,
): RuleResult {
  if (typeof nonceHash !== 'string' || nonceHash.length === 0) {
    return { ok: false, reason: 'nonceHash must be a nonempty string' };
  }
  if (consumedHashes.has(nonceHash)) {
    return { ok: false, reason: 'nonce already consumed: replay rejected' };
  }
  return { ok: true };
}

export type LoginBindingVerification = RuleResult;

/**
 * Binding check between the challenge and the wallet-verified signature
 * (A02). The signature account comes from the actual cryptographic
 * verification result (server side, selected wallet standard); a valid
 * signature over the wrong domain/network/account/intent/nonce message is
 * rejected here. A claimed account string without a verifying signature never
 * reaches this function.
 */
export function verifyLoginBinding(input: {
  challenge: LoginChallengeParts;
  /** Values the signature-verified message actually contained. */
  signedDomain: string;
  signedNetwork: string;
  signedAccountId: string;
  signedIntent: string;
  signedNonceHex: string;
  signatureAccount: string;
}): LoginBindingVerification {
  const c = input.challenge;
  if (input.signedDomain !== c.domain) return { ok: false, reason: 'signed domain mismatch' };
  if (input.signedNetwork !== c.network) return { ok: false, reason: 'signed network mismatch' };
  if (input.signedIntent !== LOGIN_INTENT) return { ok: false, reason: 'signed intent mismatch' };
  if (input.signedNonceHex !== c.nonceHex) return { ok: false, reason: 'signed nonce mismatch' };
  if (input.signedAccountId !== c.accountId) return { ok: false, reason: 'signed account mismatch' };
  // The key that produced the signature must control the challenge account.
  if (input.signatureAccount !== c.accountId) {
    return { ok: false, reason: 'signature does not verify under the challenge account' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// API credentials: shown once, bounded lifetime, per-license cap (A04-A06)
// ---------------------------------------------------------------------------

/** Server-side encodings; the secret itself never re-enters any response. */
const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** 32 random bytes -> 43-char base64url secret (display-once format). */
export function encodeCredentialSecret(bytes: Uint8Array): string {
  if (bytes.length !== NONCE_BYTES) {
    throw new RangeError(`credential secret must be exactly ${NONCE_BYTES} bytes`);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += B64URL_ALPHABET[(triple >> 18) & 63];
    out += B64URL_ALPHABET[(triple >> 12) & 63];
    if (i + 1 < bytes.length) out += B64URL_ALPHABET[(triple >> 6) & 63];
    if (i + 2 < bytes.length) out += B64URL_ALPHABET[triple & 63];
  }
  return out;
}

/** Presented secrets must match the display-once format exactly. */
export function isCredentialSecretFormat(secret: string): boolean {
  return typeof secret === 'string' && /^[A-Za-z0-9\-_]{43}$/.test(secret);
}

export type CredentialExpiryResult =
  | { ok: true; expiresAtMs: number; lifetimeMs: number }
  | { ok: false; reason: string };

/**
 * Credential lifetime: at most 7 days AND never beyond the license expiry
 * (D14). Creating credentials for an expired license is denied; renewal never
 * resurrects an expired/revoked credential because expiry is recomputed from
 * the license state at creation time only.
 */
export function resolveCredentialExpiry(
  createdMs: number,
  licenseExpiresAtMs: number,
  requestedLifetimeMs: number = CREDENTIAL_MAX_LIFETIME_MS,
): CredentialExpiryResult {
  const created = validateEpochMs(createdMs);
  if (!created.ok) return { ok: false, reason: created.reason };
  const licenseExpiry = validateEpochMs(licenseExpiresAtMs);
  if (!licenseExpiry.ok) return { ok: false, reason: licenseExpiry.reason };
  const lifetime = validateEpochMs(requestedLifetimeMs);
  if (!lifetime.ok || requestedLifetimeMs <= 0) {
    return { ok: false, reason: 'requested lifetime must be a positive number of milliseconds' };
  }
  if (requestedLifetimeMs > CREDENTIAL_MAX_LIFETIME_MS) {
    return { ok: false, reason: `credential lifetime exceeds the ${CREDENTIAL_MAX_LIFETIME_MS}ms maximum` };
  }
  if (licenseExpiresAtMs <= createdMs) {
    return { ok: false, reason: 'license is expired: no credential can be issued' };
  }
  const expiresAtMs = Math.min(createdMs + requestedLifetimeMs, licenseExpiresAtMs);
  return { ok: true, expiresAtMs, lifetimeMs: expiresAtMs - createdMs };
}

export type CredentialCreationResult =
  | { ok: true; expiresAtMs: number }
  | { ok: false; reason: string };

/** Per-license cap (A06) plus expiry rules for one creation attempt. */
export function evaluateCredentialCreation(input: {
  currentCredentialCount: number;
  createdMs: number;
  licenseExpiresAtMs: number;
  requestedLifetimeMs?: number;
}): CredentialCreationResult {
  if (!Number.isSafeInteger(input.currentCredentialCount) || input.currentCredentialCount < 0) {
    return { ok: false, reason: 'current credential count must be a nonnegative safe integer' };
  }
  if (input.currentCredentialCount >= CREDENTIALS_PER_LICENSE_MAX) {
    return {
      ok: false,
      reason: `license already holds ${CREDENTIALS_PER_LICENSE_MAX} credentials (maximum)`,
    };
  }
  const expiry = resolveCredentialExpiry(
    input.createdMs,
    input.licenseExpiresAtMs,
    input.requestedLifetimeMs,
  );
  if (!expiry.ok) return { ok: false, reason: expiry.reason };
  return { ok: true, expiresAtMs: expiry.expiresAtMs };
}

// ---------------------------------------------------------------------------
// Shared per-license quota: token bucket, 60/min with burst 10 (D13, A06)
// ---------------------------------------------------------------------------

export interface QuotaBucket {
  /** Tokens currently available (integer scale 1/1000 to stay exact). */
  tokensMilli: bigint;
  lastRefillMs: number;
}

export function initialQuotaBucket(nowMs: number, capacity: number = QUOTA_BURST): QuotaBucket {
  const now = validateEpochMs(nowMs);
  if (!now.ok) throw new RangeError(now.reason);
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError('capacity must be >= 1');
  return { tokensMilli: BigInt(capacity) * 1000n, lastRefillMs: nowMs };
}

export type QuotaDecision =
  | { allowed: true; bucket: QuotaBucket }
  | { allowed: false; reason: 'quota_exhausted'; retryAfterMs: number; bucket: QuotaBucket }
  | { allowed: false; reason: string; bucket: QuotaBucket };

/**
 * Refill and consume one token for a shared per-license bucket. Refill is
 * computed from elapsed time at QUOTA_PER_MINUTE tokens/minute, capped at the
 * burst capacity. All credentials of one license share this bucket; the
 * atomic read-modify-write belongs to PostgreSQL, this is the deterministic
 * rule it enforces.
 */
export function consumeQuota(
  bucket: QuotaBucket,
  nowMs: number,
  capacity: number = QUOTA_BURST,
  refillPerMinute: number = QUOTA_PER_MINUTE,
): QuotaDecision {
  const now = validateEpochMs(nowMs);
  if (!now.ok) return { allowed: false, reason: now.reason, bucket };
  const cap = validateEpochMs(capacity);
  if (!cap.ok || capacity < 1) return { allowed: false, reason: 'invalid capacity', bucket };
  if (!Number.isFinite(refillPerMinute) || refillPerMinute <= 0) {
    return { allowed: false, reason: 'invalid refill rate', bucket };
  }
  const elapsed = nowMs > bucket.lastRefillMs ? nowMs - bucket.lastRefillMs : 0;
  const refillMilli = (BigInt(Math.floor((elapsed * refillPerMinute) / 60_000)) * 1000n);
  const tokensMilli = bucket.tokensMilli + refillMilli > BigInt(capacity) * 1000n
    ? BigInt(capacity) * 1000n
    : bucket.tokensMilli + refillMilli;
  const updated: QuotaBucket = { tokensMilli, lastRefillMs: nowMs > bucket.lastRefillMs ? nowMs : bucket.lastRefillMs };
  if (tokensMilli >= 1000n) {
    return { allowed: true, bucket: { tokensMilli: tokensMilli - 1000n, lastRefillMs: updated.lastRefillMs } };
  }
  const missingMilli = 1000n - tokensMilli;
  const retryAfterMs = Math.max(1, Math.ceil((Number(missingMilli) / 1000) * (60_000 / refillPerMinute)));
  return { allowed: false, reason: 'quota_exhausted', retryAfterMs, bucket: updated };
}
