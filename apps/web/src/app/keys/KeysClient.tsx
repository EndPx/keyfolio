'use client';

/**
 * My Keys client: real nft_tokens_for_owner + get_license per token for the
 * signed wallet. No fake ownership, no fixture data.
 */

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../../wallet/WalletContext';
import { createTestnetClient, type LicenseJson } from '../../testnet';

type State =
  | { phase: 'signed-out' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'loaded'; licenses: LicenseJson[] };

export function KeysClient({ rpcUrl, accessContract }: { rpcUrl: string; accessContract: string }) {
  const { accountId, connecting, signIn } = useWallet();
  const [state, setState] = useState<State>({ phase: 'signed-out' });

  const load = useCallback(async () => {
    if (!accountId) {
      setState({ phase: 'signed-out' });
      return;
    }
    setState({ phase: 'loading' });
    try {
      const client = createTestnetClient({ rpcUrl, accessContract });
      const tokens = await client.viewNftTokensForOwner(accountId);
      const licenses: LicenseJson[] = [];
      for (const t of tokens) {
        try {
          const lic = await client.viewLicense(t.token_id);
          if (lic && lic.owner_id === accountId) licenses.push(lic);
        } catch {
          /* one missing token view: skip, others still show */
        }
      }
      setState({ phase: 'loaded', licenses });
    } catch (err) {
      setState({ phase: 'error', message: String((err as Error).message ?? err).slice(0, 240) });
    }
  }, [accountId, rpcUrl, accessContract]);

  useEffect(() => {
    void load();
  }, [load]);

  if (connecting) return <p className="meta-line" role="status">Connecting wallet service...</p>;
  if (state.phase === 'signed-out') {
    return (
      <div className="panel">
        <p className="terms-text">Connect your NEAR wallet to list the access keys (NFT licenses) you own.</p>
        <button type="button" className="btn btn-primary" onClick={signIn}>Connect wallet</button>
      </div>
    );
  }
  if (state.phase === 'loading') return <p className="meta-line" role="status">Reading your licenses from the contract...</p>;
  if (state.phase === 'error') {
    return (
      <div className="panel note-error" role="status">
        <p className="terms-text">License query failed: {state.message}</p>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>Retry</button>
      </div>
    );
  }
  if (state.licenses.length === 0) {
    return (
      <div className="panel">
        <p className="terms-text">You hold no access keys yet. Purchase one from the <a href="/">Marketplace</a>.</p>
      </div>
    );
  }
  return (
    <div className="card-grid">
      {state.licenses.map((lic) => (
        <article key={lic.token_id} className="card">
          <header className="seller-head">
            <div className="seller-names">
              <span className="seller-name">{lic.trader_id}</span>
              <span className="seller-handle">{lic.token_id}</span>
            </div>
            <span className={`badge ${lic.access_active ? 'badge-ok' : 'badge-warn'}`}>
              {lic.access_active ? 'ACTIVE' : 'EXPIRED OR PAUSED'}
            </span>
          </header>
          <dl className="metric-row">
            <div><dt>Access epoch</dt><dd>{lic.access_epoch}</dd></div>
            <div><dt>Expires at</dt><dd>{new Date(lic.expires_at_ms).toISOString().replace('T', ' ').slice(0, 16)} UTC</dd></div>
            <div><dt>Plan version</dt><dd>{lic.plan_version}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}
