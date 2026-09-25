'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { P } from '../lib/permissions';
import { ui } from '../lib/ui';

interface Item {
  href: string;
  label: string;
  perm?: string;
}

// Nav items are permission-gated — UI convenience ONLY. The backend still
// authorizes every request regardless of what is shown here.
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
    <div className="grid grid-cols-[240px_1fr] min-h-screen">
      <aside className="bg-panel border-r border-line p-5">
        <div className="font-bold text-lg px-3 pt-2 pb-5">🕐 Attendance</div>
        <nav>
          {ITEMS.filter((i) => !i.perm || can(i.perm)).map((i) => {
            const active = pathname === i.href;
            return (
              <Link
                key={i.href}
                href={i.href}
                className={`block px-3 py-2.5 rounded-lg mb-1 hover:bg-panel2 ${
                  active ? 'bg-panel2 text-fg' : 'text-fg'
                }`}
              >
                {i.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="px-8 py-7">
        <div className="flex justify-between items-center mb-6">
          <span className="bg-panel2 px-2.5 py-1 rounded-full text-xs text-muted">
            {me?.isPlatformAdmin ? 'Platform Admin' : me?.roles.join(', ')}
          </span>
          <button className={ui.btnGhost} onClick={logout}>
            Sign out
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
