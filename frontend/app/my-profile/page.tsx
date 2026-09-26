'use client';

import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

const ROLE_LABEL: Record<string, string> = {
  company_owner: 'Owner',
  hr_manager: 'HR Manager',
  employee: 'Employee',
  platform_admin: 'Platform Admin',
};

interface Rec { status: string; date: string }

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}

export default function MyProfile() {
  const { me } = useAuth();
  const year = new Date().getUTCFullYear();
  const { data } = useFetch<Rec[]>('/api/attendance/me');
  const records = (data ?? []).filter((r) => r.date.startsWith(`${year}-`));
  const present = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const rate = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null;

  if (!me) return null;
  const role = me.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ');

  return (
    <>
      <h2 className={`${ui.h2} mb-5`}>My Profile</h2>

      {/* Identity header */}
      <div className="surface p-6 mb-5 flex items-center gap-5">
        <div
          className="h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-ink shrink-0"
          style={{ background: 'linear-gradient(135deg,#38bdf8,#a78bfa)' }}
        >
          {initials(me.name ?? '')}
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold truncate">{me.name ?? '—'}</div>
          <div className="text-muted truncate">{me.email ?? '—'}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="pill pill-leave">{role}</span>
            {me.companyName && <span className="pill pill-present">{me.companyName}</span>}
          </div>
        </div>
      </div>

      {/* Personal attendance snapshot */}
      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        <div className="surface p-5">
          <div className="text-3xl font-bold text-emerald-300">{present}</div>
          <div className="text-muted text-[13px]">Present in {year}</div>
        </div>
        <div className="surface p-5">
          <div className="text-3xl font-bold text-red-300">{absent}</div>
          <div className="text-muted text-[13px]">Absent in {year}</div>
        </div>
        <div className="surface p-5">
          <div className="text-3xl font-bold">{rate == null ? '—' : `${rate}%`}</div>
          <div className="text-muted text-[13px]">Attendance rate</div>
        </div>
      </div>

      {/* Details + quick links */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="surface p-5">
          <h3 className="font-semibold mb-3">Details</h3>
          <dl className="text-sm">
            {[
              ['Name', me.name ?? '—'],
              ['Email', me.email ?? '—'],
              ['Company', me.companyName ?? '—'],
              ['Role', role],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 border-b border-line/60 last:border-0">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="surface p-5">
          <h3 className="font-semibold mb-3">Quick links</h3>
          <div className="flex flex-col gap-3">
            <Link href="/my-attendance" className="surface p-4 hover:brightness-110 transition flex items-center gap-3">
              <span className="text-xl">🗓️</span>
              <div>
                <div className="font-medium">My Attendance</div>
                <div className="text-muted text-xs">Yearly &amp; monthly present/absent summary</div>
              </div>
            </Link>
          </div>
          <p className="text-muted text-xs mt-4">
            You can only see your own profile and attendance. Company-wide data is restricted to
            managers and owners.
          </p>
        </div>
      </div>
    </>
  );
}
