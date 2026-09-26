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
  { href: '/my-profile', label: 'My Profile' },
  { href: '/attendance', label: 'Attendance', perm: P.ATTENDANCE_VIEW_ALL },
  { href: '/team', label: 'Team', perm: P.USERS_VIEW },
  { href: '/shifts', label: 'Shifts', perm: P.SHIFTS_VIEW },
  { href: '/reports', label: 'Reports', perm: P.REPORTS_VIEW },
  { href: '/assistant', label: 'AI Assistant', perm: P.CLAUDE_QUERY_OWN },
];

export function Shell({ children }: { children: ReactNode }) {
  const { me, can, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen">
      <aside className="bg-panel border-r border-line flex flex-col">
        <div className="font-bold text-lg px-5 pt-5 pb-4">🕐 Attendance</div>
        <nav className="flex-1 px-3 overflow-y-auto">
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
        <div className="border-t border-line p-3">
          <div className="px-3 pb-2">
            <div className="text-sm truncate">{me?.name ?? me?.roles.join(', ')}</div>
            <div className="text-muted text-xs">
              {me?.isPlatformAdmin ? 'Platform Admin' : me?.roles.join(', ')}
            </div>
          </div>
          <button className={`${ui.btnGhost} w-full`} onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="px-8 py-7">{children}</main>
    </div>
  );
}
