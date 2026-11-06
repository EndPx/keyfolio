import { requireAppConfig } from '@keyfolio/domain';
import { buildApp, createBuildInfo } from './app.js';

// Fail fast on missing/unknown KEYFOLIO_MODE or non-fixture secrets. There is
// no default mode and no fallback to fixtures.
const config = requireAppConfig(process.env);
const build = createBuildInfo();
const app = buildApp(config, build);

const port = Number(process.env.PORT ?? 3000);
const host = '127.0.0.1';

app
  .listen({ port, host })
  .then((address) => {
    console.log(`[api] listening on ${address} (mode=${config.mode}, network=${config.network ?? 'none'})`);
  })
  .catch((err: unknown) => {
    console.error('[api] failed to start:', err);
    process.exit(1);
  });