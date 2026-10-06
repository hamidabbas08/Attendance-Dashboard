'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { Avatar } from '../lib/components';
import { P } from '../lib/permissions';
import { useFetch } from '../lib/useFetch';

interface Item {
  href: string;
  label: string;
  perm?: string;
  icon: ReactNode;
  group: string;
}

// Minimal inline icons (stroke, currentColor) so nav items are easier to scan.
const I = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">{d}</svg>
);
const icons = {
  dashboard: I(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  myAttendance: I(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /><path d="m9 15 2 2 4-4" /></>),
  profile: I(<><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" /></>),
  attendance: I(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></>),
  overtime: I(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>),
  team: I(<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5S15.5 16.7 15.5 20" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6M18 14.5c2 .7 3.5 2.3 3.5 4.5" /></>),
  shifts: I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  reports: I(<><path d="M4 20V5a2 2 0 0 1 2-2h9l5 5v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M14 3v5h5M8 13h6M8 17h4" /></>),
};

// Nav items are permission-gated — UI convenience ONLY. The backend still
// authorizes every request regardless of what is shown here.
const ITEMS: Item[] = [
  { href: '/', label: 'Overview', icon: icons.dashboard, group: 'Attendance' },
  { href: '/my-attendance', label: 'My Attendance', perm: P.ATTENDANCE_VIEW_OWN, icon: icons.myAttendance, group: 'Attendance' },
  { href: '/my-profile', label: 'My Profile', icon: icons.profile, group: 'Attendance' },
  { href: '/attendance', label: 'Attendance', perm: P.ATTENDANCE_VIEW_ALL, icon: icons.attendance, group: 'Workforce' },
  { href: '/overtime', label: 'Overtime', perm: P.ATTENDANCE_VIEW_OWN, icon: icons.overtime, group: 'Workforce' },
  { href: '/team', label: 'Team', perm: P.USERS_VIEW, icon: icons.team, group: 'Workforce' },
  { href: '/shifts', label: 'Shifts', perm: P.SHIFTS_VIEW, icon: icons.shifts, group: 'Workforce' },
  { href: '/reports', label: 'Reports', perm: P.REPORTS_VIEW, icon: icons.reports, group: 'Analytics' },
];
const GROUP_ORDER = ['Attendance', 'Workforce', 'Analytics'];

export function Shell({ children }: { children: ReactNode }) {
  const { me, can, logout } = useAuth();
  const pathname = usePathname();
  const meInfo = useFetch<{ employee: { avatarUrl: string | null } | null }>('/api/employees/me');
  const avatarUrl = meInfo.data?.employee?.avatarUrl ?? null;
  const roleText = me?.isPlatformAdmin ? 'Platform Admin' : me?.roles.join(', ');
  const visible = ITEMS.filter((i) => !i.perm || can(i.perm));

  const NavLink = ({ i }: { i: Item }) => {
    const active = pathname === i.href;
    return (
      <Link
        href={i.href}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
          active ? 'bg-accent/10 text-accent' : 'text-muted hover:text-fg hover:bg-white/[0.04]'
        }`}
      >
        {active && <span className="absolute left-0 top-1/2 hidden md:block h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />}
        <span className={active ? 'text-accent' : 'text-faint group-hover:text-fg transition-colors duration-150'}>{i.icon}</span>
        {i.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <aside className="bg-sidebar border-b border-line md:border-b-0 md:border-r md:sticky md:top-0 md:h-screen flex flex-col z-20">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent text-base ring-1 ring-accent/25">🕐</span>
          <span className="font-bold text-[15px] tracking-tight">Attendance</span>
        </div>

        {/* Mobile: single horizontally-scrollable row. */}
        <nav className="flex md:hidden gap-1 px-3 pb-3 overflow-x-auto">
          {visible.map((i) => <NavLink key={i.href} i={i} />)}
        </nav>

        {/* Desktop: grouped vertical navigation. */}
        <nav className="hidden md:flex md:flex-col gap-0.5 px-3 pb-2 overflow-y-auto flex-1">
          {GROUP_ORDER.map((g) => {
            const items = visible.filter((i) => i.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g} className="mb-2">
                <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint/80">{g}</div>
                {items.map((i) => <NavLink key={i.href} i={i} />)}
              </div>
            );
          })}
        </nav>

        {/* Account area */}
        <div className="border-t border-line p-3 md:mt-auto">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <Avatar src={avatarUrl} name={me?.name ?? '?'} size={38} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{me?.name ?? me?.roles.join(', ')}</div>
              <div className="text-muted text-xs truncate capitalize">{roleText}</div>
            </div>
          </div>
          <button
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-fg hover:bg-white/[0.04]"
            onClick={logout}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M15 17l5-5-5-5M20 12H9M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mx-auto w-full max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
}
