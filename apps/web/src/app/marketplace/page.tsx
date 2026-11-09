import { CARLA_TWR_SERIES, MARKET_SELLERS, PLAN } from '../../fixture';
import { getWebConfig } from '../../config';

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
        <div className="dashboard-head"><div><p className="eyebrow">Account-following workspace</p><h2 className="panel-title" style={{ fontSize: '20px' }}>Compare tracked coverage before access</h2></div><div className="dashboard-actions"><button className="btn btn-secondary" type="button">Refresh view</button><a className="btn btn-primary" href="#traders">Browse traders</a></div></div>
        <div className="dashboard-grid"><section className="dashboard-panel chart-panel"><div className="chart-header"><div><p className="eyebrow">Illustrative sample · Carla</p><h2 className="panel-title">Tracked return · 30 days</h2><p className="chart-legend">TWR from the latest complete window · no balances or positions shown</p></div><div className="period-tabs"><span className="active">30D</span><span>90D</span><span>Since start</span></div></div><svg viewBox="0 0 760 220" role="img" aria-label="Illustrative tracked return chart" className="chart-svg"><defs><linearGradient id="market-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16834f" stopOpacity=".22"/><stop offset="100%" stopColor="#16834f" stopOpacity="0"/></linearGradient></defs><polygon points="42,186 42,186 744,46 744,186" fill="url(#market-fill)"/><polyline points="42,186 180,172 310,150 450,128 585,92 744,46" fill="none" stroke="#16834f" strokeWidth="3" strokeLinecap="round"/><line x1="42" y1="186" x2="744" y2="186" className="chart-grid"/><text x="42" y="212" className="chart-label">Oct 8</text><text x="744" y="212" textAnchor="end" className="chart-label">Nov 7</text><circle cx="744" cy="46" r="4" fill="#16834f"/></svg></section><aside className="dashboard-panel request-panel"><div><p className="eyebrow">Fixture-only visual pattern</p><h2 className="panel-title">Pending requests</h2><p className="chart-legend">Illustrative sample · no live requests or balances</p></div><div className="request-row"><span className="request-dot"/><div><strong>Compare Carla’s coverage</strong><p>Access review · illustrative</p></div></div><div className="request-row"><span className="request-dot"/><div><strong>Review private account gate</strong><p>Entitlement required · illustrative</p></div></div><a href="#traders" className="btn btn-secondary">View marketplace</a></aside></div>
        <div className="dashboard-panel activity-panel"><p className="eyebrow">Fixture-only visual pattern</p><h2 className="panel-title">Recent activity</h2><p className="chart-legend">Illustrative sample · no transaction hashes or live requests</p><div className="activity-list"><div className="activity-row"><div><span className="activity-name">Carla · tracked snapshot</span><div className="activity-meta">Complete coverage · Nov 7, 2026 00:00 UTC</div></div><span className="activity-value">+8.24%</span><span className="activity-state">Computed by Keyfolio</span></div><div className="activity-row"><div><span className="activity-name">DeltaOne · coverage review</span><div className="activity-meta">Partial coverage · sales paused</div></div><span className="activity-value" style={{color:"var(--ink-faint)"}}>Unavailable</span><span className="activity-state">Fail-closed</span></div></div></div><div id="traders" className="card-grid">
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
