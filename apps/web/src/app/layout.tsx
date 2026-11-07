import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Keyfolio',
  description: 'Performance in public. Strategy by invitation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
