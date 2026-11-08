'use client';

import { usePathname } from 'next/navigation';

const ITEMS: { label: string; href?: string }[] = [
  { label: 'Marketplace', href: '/' },
  { label: 'My Keys' },
  { label: 'Private Account' },
  { label: 'API Access' },
  { label: 'Trader Studio' },
  { label: 'Activity' },
];

/**
 * Sidebar navigation. Unbuilt destinations are visibly disabled (aria-disabled
 * + visible note) instead of dead links; the active item follows the route.
 */
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
