import Fastify, { type FastifyInstance } from 'fastify';
import { failure, success, validateAmountRequest, type HealthData } from '@keyfolio/api-contract';
import type { AppConfig } from '@keyfolio/domain';
import { makeMeta } from './meta.js';

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
export function buildApp(config: AppConfig, build: BuildInfo = createBuildInfo()): FastifyInstance {
  const app = Fastify({ logger: false });

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

  return app;
}