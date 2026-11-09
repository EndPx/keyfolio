# KF-06a local auth/security implementation evidence

Status: `PASS_LOCAL` for the bounded local slice. This is implementation evidence for coordinator review; it is not testnet/live readiness.

## Scope delivered

- `apps/api/src/auth-service.ts` defines a server-only auth service boundary with injected `AuthStore`, clock, random source, credential hasher and `SignatureVerifier` seams.
- `POST /v1/auth/challenge` creates a 32-byte, domain/network/account-bound challenge with the existing `packages/domain/src/auth.ts` canonical message and five-minute UTC expiry.
- `POST /v1/auth/verify` requires a configured verifier, checks every binding field, atomically consumes the challenge, and creates a 15-minute session. No session or provider secret is returned in JSON.
- Session cookies are `HttpOnly; Secure; SameSite=Strict`; state-changing logout requires an explicit `x-csrf-token` matching the server-side session hash. Logout is idempotent and revokes the session.
- Credentials use 32 random bytes, display once, and are stored only through the injected hash interface. Expiry is bounded by seven days and license expiry; active credentials are capped at five and revoke is idempotent.
- Per-license quota uses the existing exact token bucket rule: 60 requests/minute with burst 10. The store interface is shared by all credentials for a license.
- `InMemoryAuthStore` is explicitly labeled test-only. Its interface exposes the atomic operations required for a future PostgreSQL implementation; no migration or provider adapter was changed.

## Validation

Focused test: `node --import tsx --test --test-force-exit apps/api/test/auth-service.test.ts`

Covered cases include challenge binding, fail-closed verifier absence, replay/single-use nonce, secure cookie flags, CSRF rejection/acceptance, logout revocation, session expiry, display-once credential hashing, five-credential cap, idempotent revoke, and shared quota burst/refill behavior.

Additional checks: `pnpm --filter @keyfolio/api build`, `pnpm --filter @keyfolio/domain typecheck`.

The full workspace `pnpm check` remains coordinator-owned final validation. No wallet signing, provider probe, secret, deployment, migration, contract, web screen, mainnet or paid-service action was performed.
