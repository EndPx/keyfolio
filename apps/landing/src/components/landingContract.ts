export type LandingMode = 'FIXTURE' | 'TESTNET' | 'LIVE';

export function getLandingWalletState(mode: LandingMode, opts: { connecting?: boolean; accountId?: string | null; initError?: string | null; fixturePreview?: boolean; configError?: string | null } = {}) {
  if (opts.configError) return { label: 'Wallet unavailable', message: `Configuration blocked: ${opts.configError}`, canAct: false };
  if (mode === 'FIXTURE') return { label: opts.fixturePreview ? 'Demo opened' : 'Open the demo', message: opts.fixturePreview ? 'Demo mode is open.' : 'Demo mode is simulated.', canAct: true };
  if (mode === 'LIVE') return { label: 'Wallet unavailable', message: 'LIVE wallet access is unavailable until production gates are accepted.', canAct: false };
  if (opts.initError) return { label: 'Wallet unavailable', message: `Wallet setup error: ${opts.initError}`, canAct: false };
  if (opts.connecting) return { label: 'Connecting', message: 'Connecting to the TESTNET wallet selector.', canAct: false };
  if (opts.accountId) return { label: 'Wallet connected', message: `Connected as ${opts.accountId}`, canAct: false };
  return { label: 'Connect NEAR wallet', message: 'TESTNET wallet selector is ready. You control every signature.', canAct: true };
}
