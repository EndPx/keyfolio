'use client';

/** Activity client: real purchases from the contract for the signed wallet. */

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../../wallet/WalletContext';
import { createTestnetClient } from '../../testnet';

export function ActivityClient({ rpcUrl, accessContract }: { rpcUrl: string; accessContract: string }) {
  const { accountId, connecting, signIn } = useWallet();
  const [purchases, setPurchases] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    setError(null);
    try {
      const client = createTestnetClient({ rpcUrl, accessContract });
      const tokens = await client.viewNftTokensForOwner(accountId);
      setPurchases(tokens.map((t) => t.token_id));
    } catch (err) {
      setError(String((err as Error).message ?? err).slice(0, 200));
    }
  }, [accountId, rpcUrl, accessContract]);

  useEffect(() => {
    void load();
  }, [load]);

  if (connecting) return <p className="meta-line" role="status">Connecting wallet service...</p>;
  if (!accountId) {
    return (
      <div className="panel">
        <p className="terms-text">Connect your wallet to see your purchase history from the contract.</p>
        <button type="button" className="btn btn-primary" onClick={signIn}>Connect wallet</button>
      </div>
    );
  }
  if (error) {
    return (
      <div className="panel note-error" role="status">
        <p className="terms-text">Query failed: {error}</p>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>Retry</button>
      </div>
    );
  }
  return (
    <div className="panel">
      <h2 className="panel-title">Purchases (from the contract)</h2>
      {purchases && purchases.length > 0 ? (
        <ul className="contents-list">
          {purchases.map((tid) => (
            <li key={tid}>Access NFT held - {tid}</li>
          ))}
        </ul>
      ) : (
        <p className="terms-text">No purchases yet.</p>
      )}
      <h2 className="panel-title">Copy orders &amp; refunds</h2>
      <p className="terms-text">
        These flow through the backend ledger (ingestion is KF-01/KF-03 scope, not wired in this
        prototype milestone) - no fabricated entries are shown.
      </p>
    </div>
  );
}
