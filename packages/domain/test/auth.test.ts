import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CREDENTIALS_PER_LICENSE_MAX,
  CHALLENGE_TTL_MS,
  QUOTA_BURST,
  QUOTA_PER_MINUTE,
  SESSION_TTL_MS,
  buildLoginChallengeMessage,
  consumeNonce,
  consumeQuota,
  encodeCredentialSecret,
  evaluateCredentialCreation,
  initialQuotaBucket,
  isCredentialSecretFormat,
  resolveCredentialExpiry,
  validateLoginChallenge,
  verifyLoginBinding,
  type LoginChallengeParts,
} from '../src/auth.js';

const NOW = 1_700_000_000_000;
const challenge: LoginChallengeParts = {
  domain: 'keyfolio.example',
  network: 'testnet',
  accountId: 'trader.testnet',
  nonceHex: 'a'.repeat(64),
  challengeId: 'ch-1',
  issuedAtMs: NOW,
};

test('challenge constants match D13/D14/D15 defaults', () => {
  assert.equal(CHALLENGE_TTL_MS, 300_000);
  assert.equal(SESSION_TTL_MS, 900_000);
  assert.equal(QUOTA_PER_MINUTE, 60);
  assert.equal(QUOTA_BURST, 10);
  assert.equal(CREDENTIALS_PER_LICENSE_MAX, 5);
});

test('challenge message is deterministic and carries every binding field', () => {
  const msg = buildLoginChallengeMessage(challenge);
  const expected = [
    'domain: keyfolio.example',
    'network: testnet',
    'account: trader.testnet',
    'intent: keyfolio_login',
    'challenge_id: ch-1',
    `nonce: ${'a'.repeat(64)}`,
    `issued_at: ${NOW}`,
    `expires_at: ${NOW + CHALLENGE_TTL_MS}`,
  ].join('\n');
  assert.equal(msg, expected);
  assert.equal(buildLoginChallengeMessage(challenge), msg, 'same inputs -> byte-identical message');
});

test('A01: validation accepts a fresh challenge and rejects wrong domain/account/network/expiry', () => {
  assert.deepEqual(validateLoginChallenge(challenge, NOW), { ok: true, expiresAtMs: NOW + CHALLENGE_TTL_MS });
  assert.deepEqual(validateLoginChallenge(challenge, NOW + CHALLENGE_TTL_MS), {
    ok: true,
    expiresAtMs: NOW + CHALLENGE_TTL_MS,
  });
  assert.equal(validateLoginChallenge(challenge, NOW + CHALLENGE_TTL_MS + 1).ok, false, 'expired');
  assert.equal(validateLoginChallenge(challenge, NOW - 1).ok, false, 'not yet issued');

  // Structural validation: malformed inputs are rejected. Whether a domain or
  // account is the WRONG one is a binding question (see verifyLoginBinding/A02).
  const badDomain = { ...challenge, domain: 'evil example' };
  assert.equal(validateLoginChallenge(badDomain, NOW).ok, false, 'domain whitespace rejected');
  const emptyDomain = { ...challenge, domain: '' };
  assert.equal(validateLoginChallenge(emptyDomain, NOW).ok, false);
  const malformedAccount = { ...challenge, accountId: 'Attacker.testnet' };
  assert.equal(validateLoginChallenge(malformedAccount, NOW).ok, false, 'uppercase account rejected');
  const badNonce = { ...challenge, nonceHex: 'A'.repeat(64) };
  assert.equal(validateLoginChallenge(badNonce, NOW).ok, false, 'uppercase nonce rejected');
  const shortNonce = { ...challenge, nonceHex: 'ab' };
  assert.equal(validateLoginChallenge(shortNonce, NOW).ok, false);
});

test('A01: a consumed nonce rejects replay and simultaneous reuse', () => {
  const consumed = new Set(['nonce-hash-1']);
  assert.equal(consumeNonce(consumed, 'nonce-hash-1').ok, false, 'replay rejected');
  // A second simultaneous attempt consults the same store: still rejected.
  assert.equal(consumeNonce(consumed, 'nonce-hash-1').ok, false);
  assert.deepEqual(consumeNonce(new Set(), 'nonce-hash-2'), { ok: true });
  assert.equal(consumeNonce(consumed, '').ok, false);
});

test('A02: binding verification requires the signature to match every challenge field', () => {
  const ok = verifyLoginBinding({
    challenge,
    signedDomain: challenge.domain,
    signedNetwork: challenge.network,
    signedAccountId: challenge.accountId,
    signedIntent: 'keyfolio_login',
    signedNonceHex: challenge.nonceHex,
    signatureAccount: challenge.accountId,
  });
  assert.deepEqual(ok, { ok: true });

  const mismatches: Array<[string, Partial<Parameters<typeof verifyLoginBinding>[0]>]> = [
    ['domain', { signedDomain: 'evil.example' }],
    ['network', { signedNetwork: 'mainnet' }],
    ['account', { signedAccountId: 'attacker.testnet' }],
    ['intent', { signedIntent: 'keyfolio_trade' }],
    ['nonce', { signedNonceHex: 'b'.repeat(64) }],
    ['signer', { signatureAccount: 'other.testnet' }],
  ];
  for (const [label, patch] of mismatches) {
    const r = verifyLoginBinding({
      challenge,
      signedDomain: challenge.domain,
      signedNetwork: challenge.network,
      signedAccountId: challenge.accountId,
      signedIntent: 'keyfolio_login',
      signedNonceHex: challenge.nonceHex,
      signatureAccount: challenge.accountId,
      ...patch,
    });
    assert.equal(r.ok, false, `expected ${label} mismatch to be rejected`);
    if (!r.ok) assert.match(r.reason, new RegExp(label === 'signer' ? 'signature' : label));
  }
});

test('A04: encoded secrets are 43-char base64url from exactly 32 bytes', () => {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) bytes[i] = i * 7 + 3;
  const secret = encodeCredentialSecret(bytes);
  assert.equal(secret.length, 43);
  assert.equal(isCredentialSecretFormat(secret), true);
  const other = bytes.slice();
  other[0] = 255;
  assert.notEqual(encodeCredentialSecret(other), secret, 'distinct inputs -> distinct secrets');
  assert.equal(isCredentialSecretFormat('short'), false);
  assert.equal(isCredentialSecretFormat('='.repeat(43)), false);
  assert.throws(() => encodeCredentialSecret(new Uint8Array(31)), /32 bytes/);
  assert.throws(() => encodeCredentialSecret(new Uint8Array(33)), /32 bytes/);
});

test('A05/D14: credential expiry is min(7d, license expiry) and denies expired licenses', () => {
  const licenseExpires = NOW + 30 * 86_400_000;
  const full = resolveCredentialExpiry(NOW, licenseExpires);
  assert.deepEqual(full, { ok: true, expiresAtMs: NOW + 7 * 86_400_000, lifetimeMs: 7 * 86_400_000 });

  const shortLicense = resolveCredentialExpiry(NOW, NOW + 86_400_000);
  assert.deepEqual(shortLicense, { ok: true, expiresAtMs: NOW + 86_400_000, lifetimeMs: 86_400_000 });

  const expiredLicense = resolveCredentialExpiry(NOW, NOW - 1);
  assert.equal(expiredLicense.ok, false);
  if (!expiredLicense.ok) assert.match(expiredLicense.reason, /expired/);

  const tooLong = resolveCredentialExpiry(NOW, licenseExpires, 8 * 86_400_000);
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.match(tooLong.reason, /maximum/);
});

test('A06: credential creation enforces the per-license cap of 5', () => {
  const licenseExpires = NOW + 30 * 86_400_000;
  const fourth = evaluateCredentialCreation({ currentCredentialCount: 4, createdMs: NOW, licenseExpiresAtMs: licenseExpires });
  assert.equal(fourth.ok, true);
  const fifth = evaluateCredentialCreation({ currentCredentialCount: 5, createdMs: NOW, licenseExpiresAtMs: licenseExpires });
  assert.equal(fifth.ok, false);
  if (!fifth.ok) assert.match(fifth.reason, /maximum/);
  const negative = evaluateCredentialCreation({ currentCredentialCount: -1, createdMs: NOW, licenseExpiresAtMs: licenseExpires });
  assert.equal(negative.ok, false);
});

test('A06/D13: shared token bucket allows the burst then throttles to 60/min', () => {
  let bucket = initialQuotaBucket(NOW);
  // Burst 10 accepted immediately.
  for (let i = 0; i < 10; i += 1) {
    const d = consumeQuota(bucket, NOW);
    assert.equal(d.allowed, true, `burst request ${i + 1}`);
    if (d.allowed) bucket = d.bucket;
  }
  // 11th immediate request is throttled with a retry hint.
  const throttled = consumeQuota(bucket, NOW + 1);
  assert.equal(throttled.allowed, false);
  if (!throttled.allowed && 'retryAfterMs' in throttled) {
    assert.ok(throttled.retryAfterMs >= 900, 'one token needs ~1s of refill');
  }
  // After 1s exactly one new token has accrued.
  const after1s = consumeQuota(bucket, NOW + 1000);
  assert.equal(after1s.allowed, true);
  const after1sAgain = consumeQuota(after1s.allowed ? after1s.bucket : bucket, NOW + 1000);
  assert.equal(after1sAgain.allowed, false, 'only one token per second at 60/min');
  // Refill caps at the burst capacity: a long idle period does not stockpile.
  const idle = consumeQuota(initialQuotaBucket(NOW - 1_000_000), NOW);
  assert.equal(idle.allowed, true);
  if (idle.allowed) {
    const full = consumeQuota(initialQuotaBucket(NOW - 1_000_000), NOW);
    assert.equal(full.allowed, true);
    // capacity+1 immediate requests from a stockpiled bucket would exceed the burst:
    let b = initialQuotaBucket(NOW - 1_000_000);
    let count = 0;
    for (;;) {
      const d = consumeQuota(b, NOW);
      if (!d.allowed) break;
      b = d.bucket;
      count += 1;
    }
    assert.equal(count, QUOTA_BURST, 'idle refill never exceeds burst capacity');
  }
  // Out-of-order (older) timestamps never increase tokens nor move the refill point.
  let fresh = initialQuotaBucket(NOW);
  const first = consumeQuota(fresh, NOW + 5000);
  assert.equal(first.allowed, true);
  if (first.allowed) fresh = first.bucket;
  const tokensBefore = fresh.tokensMilli;
  const backwards = consumeQuota(fresh, NOW);
  assert.equal(backwards.bucket.lastRefillMs, NOW + 5000, 'refill point never regresses');
  assert.ok(
    backwards.bucket.tokensMilli <= tokensBefore,
    'an older timestamp must not add tokens',
  );
});
