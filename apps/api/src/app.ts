import Fastify, { type FastifyInstance } from 'fastify';
import { failure, success, validateAmountRequest, type HealthData } from '@keyfolio/api-contract';
import type { AppConfig } from '@keyfolio/domain';
import { makeMeta } from './meta.js';
import { AUTH_COOKIE, CSRF_COOKIE, CSRF_COOKIE_ATTRIBUTES, SESSION_COOKIE_ATTRIBUTES, AuthService, type AuthServiceOptions } from './auth-service.js';

export interface BuildInfo {
  name: string;
  version: string;
  commit: string;
}

export function createBuildInfo(): BuildInfo {
  return {
    name: 'keyfolio-api',
    version: '0.1.0',
    commit: (process.env.KEYFOLIO_BUILD_COMMIT ?? 'dev').slice(0, 12),
  };
}

/**
 * Build the Fastify app. The amount validation seam is registered ONLY in
 * FIXTURE mode, so it is unreachable in TESTNET/LIVE (a 404 there). The health
 * route reports mode/build but intentionally reports `provider: "unconfigured"`
 * — there is no fake provider readiness in this slice.
 */
export function buildApp(config: AppConfig, build: BuildInfo = createBuildInfo(), authOptions: AuthServiceOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const auth = new AuthService({ ...authOptions, domain: authOptions.domain ?? (process.env.KEYFOLIO_AUTH_DOMAIN ?? 'keyfolio.local') });

  app.get('/health', async () => {
    const data: HealthData = {
      mode: config.mode,
      build,
      network: config.network ?? null,
      provider: 'unconfigured',
    };
    return success(data, makeMeta({ coverage: 'none', stale: false }));
  });

  if (config.mode === 'FIXTURE') {
    app.post('/internal/validate-amount', async (request, reply) => {
      const result = validateAmountRequest(request.body);
      if (!result.valid) {
        reply.code(422);
        return failure(makeMeta(), result.code, result.reason, false);
      }
      return success(
        { valid: true, amount: result.amount, network: result.network },
        makeMeta({ coverage: 'none', stale: false }),
      );
    });
  }

  app.post('/v1/auth/challenge', async (request, reply) => {
    const body = (request.body ?? {}) as { accountId?: string; network?: 'mainnet' | 'testnet' };
    if (!body.accountId || (body.network !== 'mainnet' && body.network !== 'testnet')) {
      reply.code(422);
      return failure(makeMeta(), 'invalid_parameters', 'accountId and known network are required', false);
    }
    if (config.network !== null && body.network !== config.network) {
      reply.code(422);
      return failure(makeMeta(), 'invalid_parameters', 'network does not match the configured environment', false);
    }
    if (config.mode !== 'FIXTURE' && auth.usingTestStore) {
      reply.code(503);
      return failure(makeMeta(), 'upstream_unavailable', 'durable auth store is not configured', true);
    }
    const result = await auth.createChallenge({ accountId: body.accountId, network: body.network });
    if (!result.ok) { reply.code(422); return failure(makeMeta(), result.code, result.reason, false); }
    return success({ challenge_id: result.value.challengeId, message: result.value.message, expires_at: new Date(result.value.expiresAtMs).toISOString() }, makeMeta({ coverage: 'none', stale: false }));
  });

  app.post('/v1/auth/verify', async (request, reply) => {
    const body = (request.body ?? {}) as { challenge_id?: string; signature?: string; accountId?: string; network?: 'mainnet' | 'testnet' };
    if (!body.challenge_id || !body.signature || !body.accountId || (body.network !== 'mainnet' && body.network !== 'testnet')) {
      reply.code(422);
      return failure(makeMeta(), 'invalid_parameters', 'challenge_id, signature, accountId and known network are required', false);
    }
    if (config.network !== null && body.network !== config.network) {
      reply.code(422);
      return failure(makeMeta(), 'invalid_parameters', 'network does not match the configured environment', false);
    }
    const result = await auth.verifyChallenge({ challengeId: body.challenge_id, signature: body.signature, accountId: body.accountId, network: body.network });
    if (!result.ok) { reply.code(401); return failure(makeMeta(), result.code, result.reason, false); }
    reply.header('set-cookie', [
      `${AUTH_COOKIE}=${result.value.sessionCookie}; ${SESSION_COOKIE_ATTRIBUTES}; Max-Age=900`,
      `${CSRF_COOKIE}=${result.value.csrfToken}; ${CSRF_COOKIE_ATTRIBUTES}; Max-Age=900`,
    ]);
    return success({ account: result.value.accountId, network: result.value.network, session_expires_at: new Date(result.value.expiresAtMs).toISOString() }, makeMeta({ coverage: 'none', stale: false }));
  });

  app.post('/v1/auth/logout', async (request, reply) => {
    const cookie = parseCookie(request.headers.cookie, AUTH_COOKIE);
    if (cookie) {
      const csrf = request.headers['x-csrf-token'] as string | undefined;
      const checked = await auth.requireCsrf(cookie, csrf ?? '');
      if (!checked.ok) { reply.code(401); return failure(makeMeta(), checked.code, checked.reason, false); }
      await auth.revokeSession(cookie);
    }
    reply.header('set-cookie', [`${AUTH_COOKIE}=; ${SESSION_COOKIE_ATTRIBUTES}; Max-Age=0`, `${CSRF_COOKIE}=; ${CSRF_COOKIE_ATTRIBUTES}; Max-Age=0`]);
    return success({ logged_out: true }, makeMeta({ coverage: 'none', stale: false }));
  });

  app.decorate('keyfolioAuth', auth);

  return app;
}

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}
