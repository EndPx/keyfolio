import { getWebConfig } from '../../config';
import { KeysClient } from './KeysClient';

/**
 * My Keys (KF-08b.3): real enumeration + license views for the signed
 * wallet in TESTNET; a labeled demo panel in FIXTURE; not-wired in LIVE.
 */
export default function KeysPage() {
  const cfg = getWebConfig();
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">My Keys</h1>
      {cfg.ok && cfg.mode === 'TESTNET' ? (
        <KeysClient rpcUrl="https://rpc.testnet.near.org" accessContract={process.env.NEXT_PUBLIC_ACCESS_CONTRACT_ID ?? 'keyfolio-access.testnet'} />
      ) : cfg.ok && cfg.mode === 'FIXTURE' ? (
        <div className="panel">
          <p className="terms-text">
            Demo mode: license listing requires a connected NEAR testnet wallet. The wallet flow
            lives in TESTNET mode; nothing here is real in FIXTURE.
          </p>
        </div>
      ) : (
        <div className="panel note-error" role="status">
          <p className="terms-text">
            {cfg.ok
              ? `${cfg.mode} mode: license listing is wired for testnet only.`
              : `Configuration error: ${cfg.error}`}
          </p>
        </div>
      )}
    </section>
  );
}
