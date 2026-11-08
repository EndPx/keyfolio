import { getWebConfig } from '../../config';
import { StudioClient } from './StudioClient';

/**
 * Trader Studio (KF-08b.3): seller console over REAL contract state in
 * TESTNET. Performance metrics are NEVER seller-editable (KF-D015).
 */
export default function StudioPage() {
  const cfg = getWebConfig();
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">Trader Studio</h1>
      <p className="sample-note">Seller console · performance metrics are computed by Keyfolio and cannot be edited here</p>
      {cfg.ok && cfg.mode === 'TESTNET' ? (
        <StudioClient rpcUrl="https://rpc.testnet.near.org" accessContract={process.env.NEXT_PUBLIC_ACCESS_CONTRACT_ID ?? 'keyfolio-access.testnet'} />
      ) : cfg.ok && cfg.mode === 'FIXTURE' ? (
        <div className="panel">
          <p className="terms-text">
            Demo mode: the seller console (earnings withdrawal, listing state) runs against the
            testnet contract in TESTNET mode. Nothing here is real in FIXTURE.
          </p>
        </div>
      ) : (
        <div className="panel note-error" role="status">
          <p className="terms-text">
            {cfg.ok
              ? `${cfg.mode} mode: the seller console is wired for testnet only.`
              : `Configuration error: ${cfg.error}`}
          </p>
        </div>
      )}
    </section>
  );
}
