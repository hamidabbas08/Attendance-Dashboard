import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';
import { P } from '../permissions';

interface Item {
  to: string;
  label: string;
  perm?: string;
}

// Nav items are permission-gated — this is UI convenience ONLY. The backend
// still authorizes every request regardless of what is shown here.
const ITEMS: Item[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/my-attendance', label: 'My Attendance', perm: P.ATTENDANCE_VIEW_OWN },
  { to: '/employees', label: 'Employees', perm: P.EMPLOYEES_VIEW },
  { to: '/attendance', label: 'Attendance', perm: P.ATTENDANCE_VIEW_ALL },
  { to: '/shifts', label: 'Shifts', perm: P.SHIFTS_VIEW },
  { to: '/reports', label: 'Reports', perm: P.REPORTS_VIEW },
  { to: '/assistant', label: 'AI Assistant', perm: P.CLAUDE_QUERY_OWN },
  { to: '/slack', label: 'Slack Integration', perm: P.SLACK_VIEW },
];

export function Layout({ children }: { children: ReactNode }) {
  const { me, can, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">🕐 Attendance</div>
        <nav className="nav">
          {ITEMS.filter((i) => !i.perm || can(i.perm)).map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'}>
              {i.label}
            </NavLink>
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
