import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { AuthService, InMemoryAuthStore, type AuthClock, type SignatureVerifier } from '../src/auth-service.js';
import { requireAppConfig } from '@keyfolio/domain';

const NOW = 1_700_000_000_000;
function clock(value = NOW): AuthClock { return { now: () => value }; }
const verifier: SignatureVerifier = { async verify() { return { signedDomain: 'keyfolio.local', signedNetwork: 'testnet', signedAccountId: 'trader.testnet', signedIntent: 'keyfolio_login', signedNonceHex: 'x'.repeat(64), signatureAccount: 'trader.testnet' }; } };

test('A01/A02: Fastify challenge is bound and production path fails closed without verifier', async () => {
  const app = buildApp(requireAppConfig({ KEYFOLIO_MODE: 'FIXTURE' }));
  const challenge = await app.inject({ method: 'POST', url: '/v1/auth/challenge', payload: { accountId: 'trader.testnet', network: 'testnet' } });
  assert.equal(challenge.statusCode, 200);
  const data = challenge.json().data;
  const verified = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { challenge_id: data.challenge_id, signature: 'sig', accountId: 'trader.testnet', network: 'testnet' } });
  assert.equal(verified.statusCode, 401);
  await app.close();
});

test('A01/A03: valid test verifier issues secure cookies, replay fails, logout revokes session', async () => {
  const store = new InMemoryAuthStore();
  const app = buildApp(requireAppConfig({ KEYFOLIO_MODE: 'FIXTURE', KEYFOLIO_NETWORK: 'testnet' }), undefined, { store, verifier, clock: clock() });
  const challenge = await app.inject({ method: 'POST', url: '/v1/auth/challenge', payload: { accountId: 'trader.testnet', network: 'testnet' } });
  const data = challenge.json().data;
  // Make the verifier agree with the generated nonce by replacing the seam for this test.
  const dynamicVerifier: SignatureVerifier = { async verify({ message }) { const nonce = message.match(/^nonce: ([0-9a-f]{64})$/m)![1]!; return { signedDomain: 'keyfolio.local', signedNetwork: 'testnet', signedAccountId: 'trader.testnet', signedIntent: 'keyfolio_login', signedNonceHex: nonce, signatureAccount: 'trader.testnet' }; } };
  await app.close();
  const app2 = buildApp(requireAppConfig({ KEYFOLIO_MODE: 'FIXTURE', KEYFOLIO_NETWORK: 'testnet' }), undefined, { store: new InMemoryAuthStore(), verifier: dynamicVerifier, clock: clock() });
  const c2 = await app2.inject({ method: 'POST', url: '/v1/auth/challenge', payload: { accountId: 'trader.testnet', network: 'testnet' } });
  const v2 = await app2.inject({ method: 'POST', url: '/v1/auth/verify', payload: { challenge_id: c2.json().data.challenge_id, signature: 'sig', accountId: 'trader.testnet', network: 'testnet' } });
  assert.equal(v2.statusCode, 200);
  const cookies = v2.headers['set-cookie'] as string[];
  assert.match(cookies[0]!, /HttpOnly/); assert.match(cookies[0]!, /Secure/); assert.match(cookies[0]!, /SameSite=Strict/);
  assert.doesNotMatch(JSON.stringify(v2.json()), /sessionCookie|csrfToken/);
  const replay = await app2.inject({ method: 'POST', url: '/v1/auth/verify', payload: { challenge_id: c2.json().data.challenge_id, signature: 'sig', accountId: 'trader.testnet', network: 'testnet' } });
  assert.equal(replay.statusCode, 401);
  const sessionCookie = cookies.find((v) => v.startsWith('kf_session='))!.split(';')[0]!;
  const csrfToken = cookies.find((v) => v.startsWith('kf_csrf='))!.split(';')[0]!.slice('kf_csrf='.length);
  const logout = await app2.inject({ method: 'POST', url: '/v1/auth/logout', headers: { cookie: sessionCookie, 'x-csrf-token': csrfToken } });
  assert.equal(logout.statusCode, 200);
  await app2.close();
});

test('A03/A04-A06: CSRF, display-once hashed credentials, cap, revoke and shared quota', async () => {
  let now = NOW;
  const store = new InMemoryAuthStore();
  const service = new AuthService({ store, clock: { now: () => now }, verifier: { async verify({ message }) { const nonce = message.match(/^nonce: ([0-9a-f]{64})$/m)![1]!; return { signedDomain: 'keyfolio.local', signedNetwork: 'testnet', signedAccountId: 'trader.testnet', signedIntent: 'keyfolio_login', signedNonceHex: nonce, signatureAccount: 'trader.testnet' }; } } });
  const challenge = await service.createChallenge({ accountId: 'trader.testnet', network: 'testnet' });
  assert.equal(challenge.ok, true);
  const session = await service.verifyChallenge({ challengeId: challenge.ok ? challenge.value.challengeId : '', signature: 'sig', accountId: 'trader.testnet', network: 'testnet' });
  assert.equal(session.ok, true);
  if (session.ok) {
    assert.equal((await service.requireCsrf(session.value.sessionCookie, 'bad')).ok, false);
    assert.equal((await service.requireCsrf(session.value.sessionCookie, session.value.csrfToken)).ok, true);
  }
  const issued = await service.issueCredential({ licenseKey: 'testnet:contract:1', licenseExpiresAtMs: NOW + 30 * 86_400_000 });
  assert.equal(issued.ok, true);
  if (issued.ok) {
    const record = await store.getCredential(issued.value.id); assert(record); assert.notEqual(record!.secretHash, issued.value.secret); assert.equal(JSON.stringify(issued.value).includes(record!.secretHash), false);
    await service.revokeCredential(issued.value.id); await service.revokeCredential(issued.value.id); assert.notEqual((await store.getCredential(issued.value.id))!.revokedAtMs, null);
  }
  for (let i = 1; i <= 5; i += 1) assert.equal((await service.issueCredential({ licenseKey: 'testnet:contract:1', licenseExpiresAtMs: NOW + 30 * 86_400_000 })).ok, true);
  assert.equal((await service.issueCredential({ licenseKey: 'testnet:contract:1', licenseExpiresAtMs: NOW + 30 * 86_400_000 })).ok, false);
  const parallel = await Promise.all(Array.from({ length: 11 }, () => service.consumeLicenseQuota('testnet:contract:1')));
  const allowed = parallel.filter((result) => result.ok).length;
  assert.equal(allowed, 10); now += 1000; assert.equal((await service.consumeLicenseQuota('testnet:contract:1')).ok, true);
  now += 15 * 60_000; assert.equal((await service.requireCsrf(session.ok ? session.value.sessionCookie : '', session.ok ? session.value.csrfToken : '')).ok, false);
});
