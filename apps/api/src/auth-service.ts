import {
  CHALLENGE_TTL_MS,
  CREDENTIALS_PER_LICENSE_MAX,
  SESSION_TTL_MS,
  buildLoginChallengeMessage,
  consumeQuota,
  encodeCredentialSecret,
  evaluateCredentialCreation,
  initialQuotaBucket,
  resolveCredentialExpiry,
  validateLoginChallenge,
  verifyLoginBinding,
  type LoginChallengeParts,
  type QuotaBucket,
} from '@keyfolio/domain';
import type { KnownNetwork } from '@keyfolio/domain';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export interface SignatureVerification {
  signedDomain: string;
  signedNetwork: string;
  signedAccountId: string;
  signedIntent: string;
  signedNonceHex: string;
  signatureAccount: string;
}

/** Server-only wallet verification boundary. A real implementation belongs to the selected wallet standard. */
export interface SignatureVerifier {
  verify(input: { message: string; signature: string; accountId: string; network: KnownNetwork }): Promise<SignatureVerification>;
}

export interface AuthClock { now(): number }
export interface AuthRandom { bytes(size: number): Uint8Array; id(): string }
export interface CredentialHasher { hash(secret: string): Promise<string>; verify(secret: string, encoded: string): Promise<boolean> }

export interface ChallengeRecord extends LoginChallengeParts { consumed: boolean }
export interface SessionRecord { idHash: string; accountId: string; network: KnownNetwork; csrfHash: string; expiresAtMs: number; revokedAtMs: number | null }
export interface CredentialRecord { id: string; licenseKey: string; secretHash: string; expiresAtMs: number; revokedAtMs: number | null }

export interface AuthStore {
  saveChallenge(record: ChallengeRecord): Promise<void>;
  getChallenge(id: string): Promise<ChallengeRecord | null>;
  /** Must be atomic in the durable implementation. */
  consumeChallenge(id: string): Promise<boolean>;
  saveSession(record: SessionRecord): Promise<void>;
  getSession(idHash: string): Promise<SessionRecord | null>;
  revokeSession(idHash: string, atMs: number): Promise<void>;
  countCredentials(licenseKey: string): Promise<number>;
  saveCredential(record: CredentialRecord): Promise<void>;
  getCredential(id: string): Promise<CredentialRecord | null>;
  revokeCredential(id: string, atMs: number): Promise<void>;
  getQuota(licenseKey: string): Promise<QuotaBucket | null>;
  saveQuota(licenseKey: string, bucket: QuotaBucket): Promise<void>;
}

/** In-memory store is test-only. PostgreSQL must provide the same atomic methods. */
export class InMemoryAuthStore implements AuthStore {
  readonly testOnly = true as const;
  private readonly challenges = new Map<string, ChallengeRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly credentials = new Map<string, CredentialRecord>();
  private readonly quotas = new Map<string, QuotaBucket>();
  async saveChallenge(r: ChallengeRecord) { this.challenges.set(r.challengeId, r); }
  async getChallenge(id: string) { return this.challenges.get(id) ?? null; }
  async consumeChallenge(id: string) { const r = this.challenges.get(id); if (!r || r.consumed) return false; r.consumed = true; return true; }
  async saveSession(r: SessionRecord) { this.sessions.set(r.idHash, r); }
  async getSession(idHash: string) { return this.sessions.get(idHash) ?? null; }
  async revokeSession(idHash: string, atMs: number) { const r = this.sessions.get(idHash); if (r && r.revokedAtMs === null) r.revokedAtMs = atMs; }
  async countCredentials(licenseKey: string) { return [...this.credentials.values()].filter((r) => r.licenseKey === licenseKey && r.revokedAtMs === null).length; }
  async saveCredential(r: CredentialRecord) { this.credentials.set(r.id, r); }
  async getCredential(id: string) { return this.credentials.get(id) ?? null; }
  async revokeCredential(id: string, atMs: number) { const r = this.credentials.get(id); if (r && r.revokedAtMs === null) r.revokedAtMs = atMs; }
  async getQuota(licenseKey: string) { return this.quotas.get(licenseKey) ?? null; }
  async saveQuota(licenseKey: string, bucket: QuotaBucket) { this.quotas.set(licenseKey, bucket); }
}

export class NodeCredentialHasher implements CredentialHasher {
  async hash(secret: string) { const salt = randomBytes(16); const derived = scryptSync(secret, salt, 32); return `scrypt$v1$${salt.toString('base64url')}$${derived.toString('base64url')}`; }
  async verify(secret: string, encoded: string) {
    const [, version, saltText, hashText] = encoded.split('$');
    if (version !== 'v1' || !saltText || !hashText) return false;
    const expected = Buffer.from(hashText, 'base64url');
    const actual = scryptSync(secret, Buffer.from(saltText, 'base64url'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}

export interface AuthServiceOptions { store?: AuthStore; verifier?: SignatureVerifier; clock?: AuthClock; random?: AuthRandom; hasher?: CredentialHasher; domain?: string }
export type ServiceResult<T> = { ok: true; value: T } | { ok: false; code: string; reason: string };

const nodeRandom: AuthRandom = { bytes: (size) => randomBytes(size), id: () => randomUUID() };
const systemClock: AuthClock = { now: () => Date.now() };
const hashId = (value: string) => createHash('sha256').update(value).digest('base64url');

export class AuthService {
  readonly store: AuthStore;
  readonly usingTestStore: boolean;
  private readonly verifier?: SignatureVerifier;
  private readonly clock: AuthClock;
  private readonly random: AuthRandom;
  private readonly hasher: CredentialHasher;
  private readonly domain: string;
  private readonly licenseLocks = new Map<string, Promise<void>>();
  constructor(options: AuthServiceOptions = {}) {
    this.usingTestStore = !options.store;
    this.store = options.store ?? new InMemoryAuthStore();
    this.verifier = options.verifier;
    this.clock = options.clock ?? systemClock;
    this.random = options.random ?? nodeRandom;
    this.hasher = options.hasher ?? new NodeCredentialHasher();
    this.domain = options.domain ?? 'keyfolio.local';
  }
  async createChallenge(input: { accountId: string; network: KnownNetwork }): Promise<ServiceResult<{ challengeId: string; message: string; expiresAtMs: number }>> {
    const issuedAtMs = this.clock.now();
    const record: ChallengeRecord = { domain: this.domain, network: input.network, accountId: input.accountId, nonceHex: Buffer.from(this.random.bytes(32)).toString('hex'), challengeId: this.random.id(), issuedAtMs, consumed: false };
    const valid = validateLoginChallenge(record, issuedAtMs);
    if (!valid.ok) return { ok: false, code: 'invalid_parameters', reason: valid.reason };
    await this.store.saveChallenge(record);
    return { ok: true, value: { challengeId: record.challengeId, message: buildLoginChallengeMessage(record), expiresAtMs: valid.expiresAtMs } };
  }
  async verifyChallenge(input: { challengeId: string; signature: string; accountId: string; network: KnownNetwork }): Promise<ServiceResult<{ sessionCookie: string; csrfToken: string; expiresAtMs: number; accountId: string; network: KnownNetwork }>> {
    if (!this.verifier) return { ok: false, code: 'invalid_authentication', reason: 'real signature verifier is not configured' };
    const challenge = await this.store.getChallenge(input.challengeId);
    if (!challenge) return { ok: false, code: 'invalid_authentication', reason: 'unknown challenge' };
    const now = this.clock.now();
    const valid = validateLoginChallenge(challenge, now);
    if (!valid.ok) return { ok: false, code: 'invalid_authentication', reason: valid.reason };
    if (challenge.accountId !== input.accountId || challenge.network !== input.network) return { ok: false, code: 'invalid_authentication', reason: 'challenge binding mismatch' };
    let verified: SignatureVerification;
    try {
      verified = await this.verifier.verify({ message: buildLoginChallengeMessage(challenge), signature: input.signature, accountId: input.accountId, network: input.network });
    } catch {
      return { ok: false, code: 'invalid_authentication', reason: 'signature verification failed' };
    }
    const binding = verifyLoginBinding({ challenge, ...verified });
    if (!binding.ok) return { ok: false, code: 'invalid_authentication', reason: binding.reason };
    if (!(await this.store.consumeChallenge(challenge.challengeId))) return { ok: false, code: 'invalid_authentication', reason: 'nonce already consumed: replay rejected' };
    const sessionCookie = Buffer.from(this.random.bytes(32)).toString('base64url');
    const csrfToken = Buffer.from(this.random.bytes(32)).toString('base64url');
    const expiresAtMs = now + SESSION_TTL_MS;
    await this.store.saveSession({ idHash: hashId(sessionCookie), accountId: input.accountId, network: input.network, csrfHash: hashId(csrfToken), expiresAtMs, revokedAtMs: null });
    return { ok: true, value: { sessionCookie, csrfToken, expiresAtMs, accountId: input.accountId, network: input.network } };
  }
  async revokeSession(cookie: string): Promise<void> { await this.store.revokeSession(hashId(cookie), this.clock.now()); }
  async requireCsrf(cookie: string, csrfToken: string): Promise<ServiceResult<SessionRecord>> {
    const session = await this.store.getSession(hashId(cookie));
    if (!session || session.revokedAtMs !== null || this.clock.now() >= session.expiresAtMs) return { ok: false, code: 'invalid_authentication', reason: 'session expired or revoked' };
    if (!csrfToken || hashId(csrfToken) !== session.csrfHash) return { ok: false, code: 'invalid_authentication', reason: 'csrf token required' };
    return { ok: true, value: session };
  }
  async issueCredential(input: { licenseKey: string; licenseExpiresAtMs: number; requestedLifetimeMs?: number }): Promise<ServiceResult<{ id: string; secret: string; expiresAtMs: number }>> {
    return this.withLicenseLock(input.licenseKey, async () => {
      const createdMs = this.clock.now();
      const count = await this.store.countCredentials(input.licenseKey);
      const policy = evaluateCredentialCreation({ currentCredentialCount: count, createdMs, licenseExpiresAtMs: input.licenseExpiresAtMs, requestedLifetimeMs: input.requestedLifetimeMs });
      if (!policy.ok) return { ok: false, code: 'quota_exceeded', reason: policy.reason };
      const secret = encodeCredentialSecret(this.random.bytes(32));
      const id = this.random.id();
      await this.store.saveCredential({ id, licenseKey: input.licenseKey, secretHash: await this.hasher.hash(secret), expiresAtMs: policy.expiresAtMs, revokedAtMs: null });
      return { ok: true, value: { id, secret, expiresAtMs: policy.expiresAtMs } };
    });
  }
  async revokeCredential(id: string): Promise<void> { await this.store.revokeCredential(id, this.clock.now()); }
  async consumeLicenseQuota(licenseKey: string): Promise<ServiceResult<{ retryAfterMs?: number }>> {
    return this.withLicenseLock(licenseKey, async () => {
      const current = (await this.store.getQuota(licenseKey)) ?? initialQuotaBucket(this.clock.now());
      const decision = consumeQuota(current, this.clock.now());
      await this.store.saveQuota(licenseKey, decision.bucket);
      return decision.allowed ? { ok: true, value: {} } : { ok: false, code: 'quota_exceeded', reason: decision.reason, ...('retryAfterMs' in decision ? { retryAfterMs: decision.retryAfterMs } : {}) } as ServiceResult<{ retryAfterMs?: number }>;
    });
  }
  private async withLicenseLock<T>(licenseKey: string, work: () => Promise<T>): Promise<T> {
    const previous = this.licenseLocks.get(licenseKey) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    this.licenseLocks.set(licenseKey, queued);
    await previous;
    try { return await work(); } finally { release(); if (this.licenseLocks.get(licenseKey) === queued) this.licenseLocks.delete(licenseKey); }
  }
}

export const AUTH_COOKIE = 'kf_session';
export const CSRF_COOKIE = 'kf_csrf';
export const SESSION_COOKIE_ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Strict';
export const CSRF_COOKIE_ATTRIBUTES = 'Path=/; Secure; SameSite=Strict';
