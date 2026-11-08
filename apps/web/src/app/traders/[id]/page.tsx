import { CARLA_PROFILE, CARLA_TWR_SERIES, PLAN, getSeller } from '../../../fixture';
import { getWebConfig } from '../../../config';

function ModeGate({ children }: { children: React.ReactNode }) {
  const cfg = getWebConfig();
  if (!cfg.ok) {
    return <p className="panel note-error">Fix the KEYFOLIO_MODE configuration to see this page.</p>;
  }
  if (cfg.mode !== 'FIXTURE') {
    return (
      <p className="panel note-error" role="status">
        {cfg.mode} mode is active: no data source is wired yet — fixture data is never served here.
      </p>
    );
  }
  return <>{children}</>;
}

/** Public chart: tracked return (TWR) in percent — never private balances. */
function TwrChart() {
  const W = 840;
  const H = 240;
  const padL = 44;
  const padB = 28;
  const maxPct = 10;
  const pts = CARLA_TWR_SERIES.map((p, i) => {
    const x = padL + (i / (CARLA_TWR_SERIES.length - 1)) * (W - padL - 16);
    const y = H - padB - (p.pct / maxPct) * (H - padB - 14);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const grid = [0, 4, 8].map((pct) => {
    const y = H - padB - (pct / maxPct) * (H - padB - 14);
    return { pct, y };
  });
  return (
    <figure className="chart-figure">
      <figcaption className="chart-caption-row">
        <span className="panel-title">Tracked return (TWR) · 30 days</span>
        <span className="chart-legend">Percent change vs period start · Oct 8 – Nov 7, 2026 · updated daily · no private balances or positions shown</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tracked return (TWR) over the last 30 days, from 0% to +8.24%" className="chart-svg">
        {grid.map((g) => (
          <g key={g.pct}>
            <line x1={padL} y1={g.y} x2={W - 16} y2={g.y} className="chart-grid" />
            <text x={padL - 8} y={g.y + 4} textAnchor="end" className="chart-label">+{g.pct}%</text>
          </g>
        ))}
        <polyline points={pts.join(' ')} fill="none" stroke="#2457D6" strokeWidth="2" />
        {[
          { i: 0, label: 'Oct 8' },
          { i: Math.floor(CARLA_TWR_SERIES.length / 2), label: 'Oct 23' },
          { i: CARLA_TWR_SERIES.length - 1, label: 'Nov 7' },
        ].map(({ i, label }) => {
          const x = padL + (i / (CARLA_TWR_SERIES.length - 1)) * (W - padL - 16);
          return (
            <text key={label} x={x} y={H - 8} textAnchor="middle" className="chart-label">{label}</text>
          );
        })}
      </svg>
    </figure>
  );
}

export default async function TraderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = getSeller(id);
  if (!seller || seller.id !== 'carla') {
    return (
      <section aria-labelledby="page-title">
        <h1 id="page-title" className="page-title">Trader not found</h1>
        <p className="meta-line">This demo milestone only includes Carla&apos;s profile. <a href="/">Back to Marketplace</a></p>
      </section>
    );
  }
  const p = CARLA_PROFILE;
  return (
    <section aria-labelledby="page-title">
      <p className="sample-note">Illustrative sample — not real performance · metrics computed by Keyfolio only</p>
      <ModeGate>
        <header className="profile-head">
          <span className="avatar avatar-xl" aria-hidden="true" />
          <div>
            <h1 id="page-title" className="page-title">{p.name}</h1>
            <p className="meta-line">{p.approach}</p>
          </div>
          <span className="badge badge-ok">COMPLETE</span>
        </header>

        <div className="metric-cards">
          <div className="card metric-card">
            <span className="metric-label">NET PNL · 30D · USD</span>
            <span className="metric-value pos">+{p.netPnlUsd.toFixed(2)} USD</span>
            <span className="metric-note">{p.settledSwaps} settled swaps · complete coverage</span>
          </div>
          <div className="card metric-card">
            <span className="metric-label">TWR · 30D</span>
            <span className="metric-value pos">{p.returnPct.toFixed(2)}%</span>
            <span className="metric-note">cash-flow adjusted</span>
          </div>
          <div className="card metric-card">
            <span className="metric-label">MAX DRAWDOWN · 30D</span>
            <span className="metric-value neg">{p.maxDrawdownPct.toFixed(2)}%</span>
            <span className="metric-note">peak-to-trough, wealth index</span>
          </div>
        </div>

        <p className="meta-line">
          Tracking complete since {p.trackedSince} (coverage start) · no gaps · updated daily at 00:00 UTC (last: Nov 7)
        </p>

        <TwrChart />

        <div className="card panel-card">
          <h2 className="panel-title">What the access key includes</h2>
          <ul className="contents-list">
            <li>Account activity and balances/positions — private, gated by the NFT entitlement check</li>
            <li>Retained history back to the earliest available date: {p.trackedSince}</li>
            <li>API access with scoped credentials (max 5 per license · shared quota 60 req/min)</li>
            <li>
              Assisted-copy eligibility on confirmed swaps up to 5 minutes old — follower funds and a
              fresh explicit signature; the NFT never grants spending authority
            </li>
          </ul>
        </div>

        <div className="terms-row">
          <div className="card panel-card">
            <h2 className="panel-title">Package</h2>
            <p className="terms-text">
              Price: {PLAN.priceLabel} per 30 days · token {PLAN.paymentToken}<br />
              Network: NEAR {PLAN.network} · contract access.&lt;account&gt; (placeholder)<br />
              Storage: {PLAN.storageNear} (separate from price)
            </p>
            <h2 className="panel-title">Refund policy</h2>
            <p className="terms-text">
              Prepaid funds vest linearly over the term. Service termination freezes earnings at the
              contract cutoff; the unvested remainder is refundable to the current NFT owner.
            </p>
          </div>
          <aside className="card privacy-panel">
            <h2 className="panel-title">Privacy note</h2>
            <p className="privacy-text">
              The Keyfolio backend processes authorized account data in plaintext. Subscribers can save
              received information. Public NFTs reveal subscription relationships. Performance shown is
              tracked, not verified profit.
            </p>
          </aside>
        </div>

        <div className="cta-row">
          <a className="btn btn-primary" href={`/checkout/${seller.id}`}>Buy access · {PLAN.priceLabel}</a>
          <a className="btn btn-secondary" href="/">Back to Marketplace</a>
        </div>
      </ModeGate>
    </section>
  );
}
