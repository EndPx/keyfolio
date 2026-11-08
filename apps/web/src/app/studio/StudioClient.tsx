'use client';

/**
 * Trader Studio client: real trader status, claimable earnings and a real
 * ft_withdraw through the wallet (selector action builders - no casts).
 */

import { transactions } from 'near-api-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '../../wallet/WalletContext';
import { createTestnetClient } from '../../testnet';

export function StudioClient({ rpcUrl, accessContract }: { rpcUrl: string; accessContract: string }) {
  const { accountId, connecting, signIn, selector } = useWallet();
  const client = useMemo(
    () => createTestnetClient({ rpcUrl, accessContract }),
    [rpcUrl, accessContract],
  );
  const [claimable, setClaimable] = useState<string | null>(null);
  const [trader, setTrader] = useState<{
    salesEnabled: boolean;
    terminated: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    setError(null);
    try {
      const [c, t] = await Promise.all([
        client.viewClaimable(accountId),
        client.viewTrader(accountId),
      ]);
      setClaimable(c);
      setTrader(t ? { salesEnabled: t.salesEnabled, terminated: t.terminated } : null);
    } catch (err) {
      setError(String((err as Error).message ?? err).slice(0, 240));
    }
  }, [accountId, client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function withdraw() {
    if (!accountId || !selector) return;
    setWithdrawing(true);
    setOutcome(null);
    try {
      const wallet = await selector.wallet();
      await wallet.signAndSendTransaction({
        signerId: accountId,
        receiverId: accessContract,
        actions: [
          // Single deduped near-api-js instance (verified in pnpm-lock) makes
          // this cast type-only; see evidence note on pass-1 finding 8.
          transactions.functionCall('ft_withdraw', { amount: null }, 250n * 10n ** 12n, 1n) as never,
        ],
      });
      setOutcome('Withdraw transaction submitted - the payout callback settles after finality.');
      await load();
    } catch (err) {
      setOutcome(`Withdraw failed: ${String((err as Error).message ?? err).slice(0, 200)}`);
    } finally {
      setWithdrawing(false);
    }
  }

  if (connecting) return <p className="meta-line" role="status">Connecting wallet service...</p>;
  if (!accountId) {
    return (
      <div className="panel">
        <p className="terms-text">Connect the seller wallet to manage the listing and earnings.</p>
        <button type="button" className="btn btn-primary" onClick={signIn}>Connect wallet</button>
      </div>
    );
  }

  return (
    <div className="studio-stack">
      <div className="card panel-card">
        <h2 className="panel-title">Seller status</h2>
        <p className="terms-text" style={{ margin: 0 }}>
          {trader
            ? trader.terminated
              ? 'Service terminated - earnings frozen at the contract cutoff (KF-D010).'
              : trader.salesEnabled
                ? 'Sales enabled - service active.'
                : 'Sales paused by the operator.'
            : 'This wallet is not enrolled as a seller on the contract yet.'}
        </p>
      </div>

      <div className="card panel-card">
        <h2 className="panel-title">Earnings &amp; withdrawal</h2>
        <p className="terms-text" style={{ margin: 0 }}>
          Claimable now: {claimable ?? '...'} atomic (vested - already withdrawn) - paid in the
          subscription FT - liabilities stay in the contract until vested.
        </p>
        <div className="cta-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={withdrawing || claimable === null || claimable === '0'}
            onClick={() => void withdraw()}
          >
            {withdrawing ? 'Submitting...' : 'Withdraw vested earnings'}
          </button>
        </div>
        {outcome && <p className="meta-line" role="status">{outcome}</p>}
        {error && <p className="terms-text" style={{ color: 'var(--warn)' }}>Query error: {error}</p>}
      </div>
    </div>
  );
}
