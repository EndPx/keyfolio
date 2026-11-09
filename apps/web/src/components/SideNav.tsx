'use client';

import { usePathname } from 'next/navigation';

const ITEMS: { label: string; href?: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'My Keys', href: '/keys' },
  { label: 'Private Account', href: '/private' },
  { label: 'API Access', href: '/api-access' },
  { label: 'Trader Studio', href: '/studio' },
  { label: 'Activity', href: '/activity' },
];

/** Sidebar navigation; the active item follows the route (aria-current). */
export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="logo-row">
        <img className="logo-mark" src="/brand/keyfolio-symbol-v1.png" alt="" width={30} height={30} aria-hidden="true" />
        <span className="logo-text">Keyfolio</span>
      </div>
      <div className="nav-links">
        {ITEMS.map((item) => {
          if (!item.href) return <span key={item.label} className="nav-link disabled" aria-disabled="true">{item.label}<span className="nav-note">later milestone</span></span>;
          const active = pathname === item.href;
          return <a key={item.label} className={`nav-link${active ? ' active' : ''}`} href={item.href} aria-current={active ? 'page' : undefined}>{item.label}</a>;
        })}
      </div>
    </nav>
  );
}
