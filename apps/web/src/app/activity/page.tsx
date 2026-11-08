import { getWebConfig } from '../../config';
import { ActivityClient } from './ActivityClient';

/**
 * Activity (KF-08b.3): purchase events from the contract (real); copy/refund
 * events require the backend ledger (KF-03 wiring) - honest states only.
 */
export default function ActivityPage() {
  const cfg = getWebConfig();
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">Activity</h1>
      {cfg.ok && cfg.mode === 'TESTNET' ? (
        <ActivityClient rpcUrl="https://rpc.testnet.near.org" accessContract={process.env.NEXT_PUBLIC_ACCESS_CONTRACT_ID ?? 'keyfolio-access.testnet'} />
      ) : cfg.ok && cfg.mode === 'FIXTURE' ? (
        <div className="panel">
          <p className="terms-text">
            Demo mode: purchase history reads the testnet contract in TESTNET mode. Copy/refund
            events additionally require the backend ledger (KF-03 wiring).
          </p>
        </div>
      ) : (
        <div className="panel note-error" role="status">
          <p className="terms-text">
            {cfg.ok
              ? `${cfg.mode} mode: activity reads are wired for testnet only.`
              : `Configuration error: ${cfg.error}`}
          </p>
        </div>
      )}
    </section>
  );
}
