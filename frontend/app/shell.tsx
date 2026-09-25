'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { P } from '../lib/permissions';

interface Item {
  href: string;
  label: string;
  perm?: string;
}

// Nav items are permission-gated — this is UI convenience ONLY. The backend
// still authorizes every request regardless of what is shown here.
const ITEMS: Item[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/my-attendance', label: 'My Attendance', perm: P.ATTENDANCE_VIEW_OWN },
  { href: '/employees', label: 'Employees', perm: P.EMPLOYEES_VIEW },
  { href: '/attendance', label: 'Attendance', perm: P.ATTENDANCE_VIEW_ALL },
  { href: '/shifts', label: 'Shifts', perm: P.SHIFTS_VIEW },
  { href: '/reports', label: 'Reports', perm: P.REPORTS_VIEW },
  { href: '/assistant', label: 'AI Assistant', perm: P.CLAUDE_QUERY_OWN },
  { href: '/slack', label: 'Slack Integration', perm: P.SLACK_VIEW },
];

export function Shell({ children }: { children: ReactNode }) {
  const { me, can, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">🕐 Attendance</div>
        <nav className="nav">
          {ITEMS.filter((i) => !i.perm || can(i.perm)).map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={pathname === i.href ? 'active' : undefined}
            >
              {i.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <span className="badge">
            {me?.isPlatformAdmin ? 'Platform Admin' : me?.roles.join(', ')}
          </span>
          <button className="ghost" onClick={logout}>
            Sign out
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
