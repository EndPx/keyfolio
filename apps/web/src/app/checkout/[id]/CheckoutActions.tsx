'use client';

import { useState } from 'react';

/**
 * FIXTURE-only checkout action flow. In FIXTURE the confirm button walks a
 * clearly labeled simulated state machine (pending -> simulated success) so
 * the demo can show the states. TESTNET/LIVE keep the button disabled until
 * real wallet signing is wired — no fake ownership or always-true verifier.
 */
export function CheckoutActions({ mode }: { mode: 'FIXTURE' | 'TESTNET' | 'LIVE' | null }) {
  const [state, setState] = useState<'idle' | 'pending' | 'success'>('idle');

  if (mode !== 'FIXTURE') {
    return (
      <div className="cta-row">
        <span className="btn btn-disabled" role="status">
          Wallet signing is not wired yet — disabled in {mode ?? 'this'} mode (next KF-08b milestone)
        </span>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="state-chip chip-success" role="status">
        Success — FIXTURE simulated receipt · no NFT was minted on any chain
      </div>
    );
  }
  if (state === 'pending') {
    return (
      <div className="state-chip chip-pending" role="status">
        Pending — waiting for wallet signature (FIXTURE simulated)
      </div>
    );
  }
  return (
    <div className="cta-row">
      <a className="btn btn-secondary" href={`/traders/carla`}>Cancel</a>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          setState('pending');
          setTimeout(() => setState('success'), 1_200);
        }}
      >
        Confirm & sign in wallet (FIXTURE simulated)
      </button>
    </div>
  );
}
