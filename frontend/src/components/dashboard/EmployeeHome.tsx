import Link from 'next/link';
import { PageHeader } from '../ui';
import { ui } from '../../lib/ui';

export function EmployeeHome({ name }: { name: string }) {
  const cards = [
    {
      href: '/my-attendance',
      title: 'My Attendance',
      desc: 'Your yearly and monthly present / absent summary.',
      icon: (
        <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /><path d="m9 15 2 2 4-4" /></>
      ),
    },
    {
      href: '/my-profile',
      title: 'My Profile',
      desc: 'Your details, role, shift and company.',
      icon: (<><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" /></>),
    },
    {
      href: '/overtime',
      title: 'My Overtime',
      desc: 'Hours worked beyond your assigned shift.',
      icon: (<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>),
    },
  ];
  return (
    <>
      <PageHeader
        title={`Welcome back${name ? `, ${name.split(' ')[0]}` : ''}`}
        description="Your personal attendance workspace."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="surface surface-hover p-5 group">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent ring-1 ring-accent/20 mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{c.icon}</svg>
            </span>
            <div className="font-semibold flex items-center gap-1.5">
              {c.title}
              <span className="text-muted opacity-0 group-hover:opacity-100 transition">→</span>
            </div>
            <p className={`${ui.muted} text-sm mt-1`}>{c.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
