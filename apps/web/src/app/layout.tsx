import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getWebConfig } from '../config';

export const metadata: Metadata = {
  title: 'Keyfolio',
  description: 'Performance in public. Strategy by invitation.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// Mode must be resolved PER REQUEST: static prerendering would bake the
// build-time mode (and fixture data) into the HTML served in every mode.
export const dynamic = 'force-dynamic';

function EnvBanner() {
  const cfg = getWebConfig();
  if (!cfg.ok) {
    return (
      <div className="banner banner-error" role="status">
        <span className="badge badge-error">CONFIG</span>
        <span>{cfg.error} — copy .env.example to .env and set KEYFOLIO_MODE.</span>
      </div>
    );
  }
  const mode = cfg.config.mode;
  const network = cfg.config.network;
  if (mode === 'FIXTURE') {
    return (
      <div className="banner" role="status">
        <span className="badge badge-warn">FIXTURE</span>
        <span>Illustrative sample data — no live account, no real performance.</span>
      </div>
    );
  }
  return (
    <div className="banner" role="status">
      <span className="badge badge-warn">{mode}</span>
      <span>near {network} · data source not connected yet (KF-08b in progress) — no fixture fallback is served in this mode.</span>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <EnvBanner />
        <div className="shell">
          <nav className="sidebar" aria-label="Primary">
            <div className="logo-row">
              <span className="logo-mark" aria-hidden="true">K</span>
              <span className="logo-text">Keyfolio</span>
            </div>
            <div className="nav-links">
              <a className="nav-link active" href="/">Marketplace</a>
              <span className="nav-link disabled" title="Later KF-08b milestone">My Keys</span>
              <span className="nav-link disabled" title="Later KF-08b milestone">Private Account</span>
              <span className="nav-link disabled" title="Later KF-08b milestone">API Access</span>
              <span className="nav-link disabled" title="Later KF-08b milestone">Trader Studio</span>
              <span className="nav-link disabled" title="Later KF-08b milestone">Activity</span>
            </div>
            <div className="user-row">
              <span className="avatar" aria-hidden="true" />
              <span className="user-text">demo user</span>
            </div>
          </nav>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
