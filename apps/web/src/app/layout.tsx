import type { Metadata, Viewport } from 'next';
import { Inter, Baloo_2 } from 'next/font/google';
import './globals.css';
import { getWebConfig } from '../config';
import { SideNav } from '../components/SideNav';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const baloo = Baloo_2({ subsets: ['latin'], weight: ['800'], variable: '--font-baloo' });

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
        <span className="dot dot-block" aria-hidden="true" />
        <span>
          <strong>Configuration error.</strong> {cfg.error} — copy .env.example (in apps/web) to
          apps/web/.env.local and set KEYFOLIO_MODE. No data is shown until then.
        </span>
      </div>
    );
  }
  const mode = cfg.config.mode;
  const network = cfg.config.network;
  if (mode === 'FIXTURE') {
    return (
      <div className="banner" role="status">
        <span className="dot dot-warn" aria-hidden="true" />
        <span>
          <strong>FIXTURE</strong> · target NEAR testnet · illustrative sample data — no live
          account, no real performance.
        </span>
      </div>
    );
  }
  return (
    <div className="banner" role="status">
      <span className="dot dot-block" aria-hidden="true" />
      <span>
        <strong>{mode}</strong> · near {network} · data source not connected yet (KF-08b in
        progress) — no fixture fallback is served in this mode.
      </span>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${baloo.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <EnvBanner />
        <div className="shell">
          <SideNav />
          <main className="main" id="main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
