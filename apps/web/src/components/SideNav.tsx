'use client';

import { usePathname } from 'next/navigation';

const ITEMS: { label: string; href?: string }[] = [
  { label: 'Marketplace', href: '/' },
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
        <span className="logo-mark" aria-hidden="true">K</span>
        <span className="logo-text">Keyfolio</span>
      </div>
      <div className="nav-links">
        {ITEMS.map((item) => {
          if (!item.href) {
            return (
              <span key={item.label} className="nav-link disabled" aria-disabled="true">
                {item.label}
                <span className="nav-note">later milestone</span>
              </span>
            );
          }
          const active = pathname === item.href;
          return (
            <a
              key={item.label}
              className={`nav-link${active ? ' active' : ''}`}
              href={item.href}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
