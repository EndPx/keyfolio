// Mode -> checkout mount decision (KF-08b). TESTNET mounts the real read-only
// checkout; FIXTURE serves the labeled demo; LIVE (and any other value) mounts
// NOTHING testnet — fail closed with no testnet query/signing component.

export type CheckoutMount = 'fixture' | 'testnet' | 'none';

export function checkoutMount(mode: 'FIXTURE' | 'TESTNET' | 'LIVE'): CheckoutMount {
  if (mode === 'TESTNET') return 'testnet';
  if (mode === 'FIXTURE') return 'fixture';
  return 'none';
}