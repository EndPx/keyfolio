import { MARKET_SELLERS, PLAN } from '../fixture';
import { getWebConfig } from '../config';

function ModeGate({ children }: { children: React.ReactNode }) {
  const cfg = getWebConfig();
  if (!cfg.ok) {
    return <p className="panel note-error">Fix the KEYFOLIO_MODE configuration to see this page.</p>;
  }
  if (cfg.mode !== 'FIXTURE') {
    return (
      <p className="panel note-error" role="status">
        {cfg.mode} mode is active: no data source is wired yet (KF-08b in progress), and fixture
        data is never served in this mode. Connect the contract/provider queries to see live data.
      </p>
    );
  }
  return <>{children}</>;
}

export default function MarketplacePage() {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">Marketplace</h1>
      <p className="sample-note">Illustrative sample — not real performance · token: KF-TEST (testnet mock)</p>
      <ModeGate>
        <div className="card-grid">
          {MARKET_SELLERS.map((s) => (
            <article key={s.id} className="card seller-card">
              <header className="seller-head">
                <span
                  className="orb"
                  aria-hidden="true"
                  style={{ background: `radial-gradient(circle at 32% 26%, ${s.gradient[0]}, ${s.gradient[1]} 74%)` }}
                />
                <div className="seller-names">
                  <span className="seller-name">{s.name}</span>
                  <span className="seller-handle">{s.handle}</span>
                </div>
                <span className={`badge ${s.state === 'complete' ? 'badge-ok' : s.state === 'partial' ? 'badge-warn' : 'badge-muted'}`}>
                  {s.state === 'complete' ? 'COMPLETE' : s.state === 'partial' ? 'PARTIAL' : 'TRACKING'}
                </span>
              </header>
              <p className="seller-approach">{s.approach}</p>
              <div className="return-block">
                <p className="eyebrow">Tracked return · 30 days (TWR)</p>
                {s.returnPct !== null ? (
                  <span className={`return-value ${s.returnPct >= 0 ? 'pos' : 'neg'}`}>
                    {s.returnPct >= 0 ? '+' : ''}
                    {s.returnPct.toFixed(2)}%
                  </span>
                ) : (
                  <span className="return-value unavailable">Unavailable</span>
                )}
              </div>
              <dl className="metric-row">
                <div>
                  <dt>Net PnL · 30d · USD</dt>
                  <dd className={s.netPnlUsd === null ? 'muted' : s.netPnlUsd >= 0 ? 'pos' : 'neg'}>
                    {s.netPnlUsd === null ? '— unavailable' : `${s.netPnlUsd >= 0 ? '+' : ''}${s.netPnlUsd.toFixed(2)} USD`}
                  </dd>
                </div>
                <div>
                  <dt>Max drawdown · 30d</dt>
                  <dd className={s.maxDrawdownPct === null ? 'muted' : 'neg'}>
                    {s.maxDrawdownPct === null ? '— unavailable' : `${s.maxDrawdownPct.toFixed(2)}%`}
                  </dd>
                </div>
                <div>
                  <dt>Settled swaps · {s.state === "complete" ? "30d" : `since ${s.trackedSince}`}</dt>
                  <dd>{s.settledSwaps === null ? '— unavailable' : s.settledSwaps}</dd>
                </div>
              </dl>
              <p className="meta-line">
                {s.state === 'complete'
                  ? `Tracking since ${s.trackedSince} · complete · no gaps`
                  : s.state === 'partial'
                    ? `Coverage · partial since ${s.trackedSince} · gaps disclosed · full-period metrics unavailable`
                    : `Tracking since ${s.trackedSince} · under one complete window`}
              </p>
              <p className="meta-line">Updated {s.snapshotAt} · daily snapshots</p>
              <div className="price-row">
                <span className="price">{s.priceLabel}</span>
                {s.salesActive ? (
                  <a className="btn btn-secondary" href={`/traders/${s.id}`}>View profile</a>
                ) : (
                  <span className="btn btn-disabled">{s.salesPausedReason}</span>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="foot-note">
          Payment token: {PLAN.paymentToken} · storage {PLAN.storageNear} (native, separate from price) ·
          metrics are always computed by Keyfolio, never seller-entered.
        </p>
      </ModeGate>
    </section>
  );
}
