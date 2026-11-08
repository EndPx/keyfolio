/**
 * Activity (KF-08b.3): purchase/copy/refund events. Purchase events come from
 * the wallet's own transaction history (real); copy/refund events require the
 * backend ledger (KF-03 wiring) — honest states only, no fabricated feed.
 */

'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '../../wallet/WalletContext';
import { viewNftTokensForOwner } from '../../testnet';

export default function ActivityPage() {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">Activity</h1>
      <ActivityBody />
    </section>
  );
}

function ActivityBody() {
  const { accountId, connecting, signIn } = useWallet();
  const [purchases, setPurchases] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) {
      setPurchases(null);
      return;
    }
    let disposed = false;
    (async () => {
      try {
        const tokens = await viewNftTokensForOwner(accountId);
        if (!disposed) setPurchases(tokens.map((t) => t.token_id));
      } catch (err) {
        if (!disposed) setError(String((err as Error).message ?? err).slice(0, 200));
      }
    })();
    return () => {
      disposed = true;
    };
  }, [accountId]);

  if (connecting) return <p className="meta-line" role="status">Connecting wallet service…</p>;
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
      </div>
    );
  }
  return (
    <div className="panel">
      <h2 className="panel-title">Purchases (from the contract)</h2>
      {purchases && purchases.length > 0 ? (
        <ul className="contents-list">
          {purchases.map((tid) => (
            <li key={tid}>Access NFT minted — {tid}</li>
          ))}
        </ul>
      ) : (
        <p className="terms-text">No purchases yet.</p>
      )}
      <h2 className="panel-title">Copy orders &amp; refunds</h2>
      <p className="terms-text">
        These flow through the backend ledger (ingestion is KF-01/KF-03 scope, not wired in this
        prototype milestone) — no fabricated entries are shown.
      </p>
    </div>
  );
}
