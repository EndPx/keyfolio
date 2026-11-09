import { resolveAppConfig } from '@keyfolio/domain';

export type LandingConfig =
  | { ok: true; mode: 'FIXTURE' | 'TESTNET' | 'LIVE'; network: string }
  | { ok: false; error: string };

export function getLandingConfig(): LandingConfig {
  const result = resolveAppConfig(process.env as Record<string, string | undefined>);
  if (!result.ok) return { ok: false, error: result.reason };
  return { ok: true, mode: result.config.mode, network: result.config.network ?? 'unknown' };
}
