import type { Metadata, Viewport } from 'next';
import { Inter, Baloo_2 } from 'next/font/google';
import './globals.css';
import { getLandingConfig } from '../config';
import { WalletProvider } from '../wallet/WalletContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const baloo = Baloo_2({ subsets: ['latin'], weight: ['800'], variable: '--font-baloo' });

export const metadata: Metadata = {
  title: 'Keyfolio - Account-following with proof',
  description: 'Compare tracked trading coverage, buy access, and follow with clear permission boundaries.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export const dynamic = 'force-dynamic';

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const cfg = getLandingConfig();
  return (
    <html lang="en" className={`${inter.variable} ${baloo.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <WalletProvider enabled={cfg.ok && cfg.mode === 'TESTNET'}>
          <main id="main">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
