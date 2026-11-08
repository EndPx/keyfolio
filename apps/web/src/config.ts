// Web config resolution. FAIL-CLOSED like the rest of Keyfolio: KEYFOLIO_MODE
// is required (copy .env.example to .env). FIXTURE mode serves the clearly
// labeled illustrative data; TESTNET/LIVE have no data source wired yet, so
// data sections render an explicit not-connected state instead of fixtures.

import { resolveAppConfig, type AppConfig } from '@keyfolio/domain';

export type WebConfig =
  | { ok: true; mode: 'FIXTURE'; config: AppConfig }
  | { ok: true; mode: 'TESTNET' | 'LIVE'; config: AppConfig }
  | { ok: false; error: string };

export function getWebConfig(): WebConfig {
  const result = resolveAppConfig(process.env as Record<string, string | undefined>);
  if (!result.ok) {
    return { ok: false, error: result.reason };
  }
  if (result.config.mode === 'FIXTURE') {
    return { ok: true, mode: 'FIXTURE', config: result.config };
  }
  return { ok: true, mode: result.config.mode, config: result.config };
}
