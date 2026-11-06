// Pure runtime-configuration resolution. This module reads a plain env-like
// object (callers pass process.env) and returns a typed result; it never reads
// process.env itself so it stays usable in the browser and in unit tests.

import { parseMode, type KeyfolioMode } from './mode.js';
import { parseNetwork, type KnownNetwork } from './network.js';

export type EnvLike = Record<string, string | undefined>;

/**
 * Names required before a NON-FIXTURE runtime may start. This is the KF-02a
 * fail-fast guard: TESTNET/LIVE must not silently fall back to fixture data or
 * a fake source. Authentication-specific secrets (TOKEN_ENCRYPTION_KEY,
 * CREDENTIAL_HASH_KEY, SESSION_SECRET, APP_ORIGIN, PROVIDER_PARTNER_JWT) are
 * recognized but enforced by the later auth/provider modules that consume them.
 */
export const REQUIRED_BY_MODE: Record<KeyfolioMode, readonly string[]> = {
  FIXTURE: [],
  TESTNET: ['NEAR_NETWORK', 'NEAR_RPC_URL', 'DATABASE_URL', 'PROVIDER_BASE_URL'],
  LIVE: [
    'NEAR_NETWORK',
    'NEAR_RPC_URL',
    'DATABASE_URL',
    'PROVIDER_BASE_URL',
    'ACCESS_CONTRACT_ID',
    'SUBSCRIPTION_FT_CONTRACT_ID',
  ],
};

/** Secret names recognized but not yet consumed by the KF-02a slice. */
export const DEFERRED_SECRETS = [
  'TOKEN_ENCRYPTION_KEY',
  'CREDENTIAL_HASH_KEY',
  'SESSION_SECRET',
  'APP_ORIGIN',
  'PROVIDER_PARTNER_JWT',
] as const;

export interface AppConfig {
  mode: KeyfolioMode;
  network: KnownNetwork | null;
  present: string[];
  missingRequired: string[];
  deferredWarnings: string[];
}

export type AppConfigResult =
  | { ok: true; config: AppConfig }
  | { ok: false; reason: string; missingRequired: string[] };

export function resolveAppConfig(env: EnvLike): AppConfigResult {
  const modeResult = parseMode(env.KEYFOLIO_MODE);
  if (!modeResult.ok) {
    return { ok: false, reason: modeResult.reason, missingRequired: ['KEYFOLIO_MODE'] };
  }
  const mode = modeResult.value;

  const required = REQUIRED_BY_MODE[mode];
  const missingRequired = required.filter((k) => !env[k] || env[k]!.trim() === '');

  let network: KnownNetwork | null = null;
  const nearNetwork = env.NEAR_NETWORK;
  if (nearNetwork !== undefined && nearNetwork.trim() !== '') {
    const networkResult = parseNetwork(nearNetwork.trim());
    if (!networkResult.ok) {
      return { ok: false, reason: `invalid NEAR_NETWORK: ${networkResult.reason}`, missingRequired: [] };
    }
    network = networkResult.value;
    if (mode === 'TESTNET' && network !== 'testnet') {
      return { ok: false, reason: 'KEYFOLIO_MODE=TESTNET requires NEAR_NETWORK=testnet', missingRequired: [] };
    }
    if (mode === 'LIVE' && network !== 'mainnet') {
      return { ok: false, reason: 'KEYFOLIO_MODE=LIVE requires NEAR_NETWORK=mainnet', missingRequired: [] };
    }
  } else if (mode !== 'FIXTURE') {
    missingRequired.push('NEAR_NETWORK');
  }

  if (missingRequired.length > 0) {
    return {
      ok: false,
      reason: `missing required configuration for ${mode} mode: ${missingRequired.join(', ')}`,
      missingRequired,
    };
  }

  const present = Object.entries(env)
    .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
    .map(([k]) => k);

  const deferredWarnings = DEFERRED_SECRETS.filter((k) => !env[k] || env[k]!.trim() === '');

  return {
    ok: true,
    config: { mode, network, present, missingRequired: [], deferredWarnings },
  };
}

/**
 * Strict variant used by the apps at startup: returns the config or throws a
 * descriptive error for missing/unknown configuration. Throwing here is the
 * intended fail-fast behavior, not a fallback to fixtures.
 */
export function requireAppConfig(env: EnvLike): AppConfig {
  const result = resolveAppConfig(env);
  if (!result.ok) {
    throw new Error(`Keyfolio configuration error: ${result.reason}`);
  }
  return result.config;
}