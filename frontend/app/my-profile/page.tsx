'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import { tally } from '../../lib/attendance';
import { to12h } from '../../lib/ui';
import { PageHeader, SectionCard, Skeleton, StatTile } from '../../lib/components';
import { useFetch } from '../../lib/useFetch';

const ROLE_LABEL: Record<string, string> = {
  platform_admin: 'Platform Admin',
  company_owner: 'Owner',
  company_admin: 'Admin',
  cto: 'CTO',
  hr_manager: 'HR Manager',
  operations_manager: 'Operations Manager',
  manager: 'Manager',
  team_lead: 'Team Lead',
  product_manager: 'Product Manager',
  developer: 'Developer',
  business_developer: 'Business Developer',
  designer: 'Designer',
  employee: 'Employee',
};

interface Rec { status: string; date: string; checkIn?: string | null; checkOut?: string | null }
interface Shift { name: string; startTime: string; endTime: string; graceMins: number }

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}

export default function MyProfile() {
  const { me } = useAuth();
  const year = new Date().getUTCFullYear();
  const { data, loading } = useFetch<Rec[]>('/api/attendance/me');
  const meInfo = useFetch<{ employee: { avatarUrl: string | null } | null; shift: Shift | null }>('/api/employees/me');
  const holidays = useFetch<{ date: string }[]>('/api/holidays');
  const holidaySet = useMemo(() => new Set((holidays.data ?? []).map((h) => h.date)), [holidays.data]);
  const shift = meInfo.data?.shift ?? null;
  const avatarUrl = meInfo.data?.employee?.avatarUrl ?? null;
  const shiftText = meInfo.loading && !meInfo.data ? '…' : shift ? `${to12h(shift.startTime)} – ${to12h(shift.endTime)} (${shift.graceMins}m grace)` : 'Not set';
  const statsLoading = loading && !data;
  const records = (data ?? []).filter((r) => r.date.startsWith(`${year}-`));
  const { present, absent } = tally(records, holidaySet);
  const rate = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null;

  if (!me) return null;
  const role = me.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ');

  return (
    <>
      <PageHeader title="My Profile" description="Your details, role, shift and attendance snapshot." />

      {/* Identity header */}
      <div className="surface p-6 mb-5 flex items-center gap-5 flex-wrap">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={me.name ?? ''}
            referrerPolicy="no-referrer"
            className="h-20 w-20 rounded-2xl object-cover shrink-0 ring-1 ring-white/10"
          />
        ) : (
          <div
            className="h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-ink shrink-0 ring-1 ring-white/10"
            style={{ background: 'linear-gradient(135deg,#38bdf8,#a78bfa)' }}
          >
            {initials(me.name ?? '')}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-2xl font-bold tracking-tight truncate">{me.name ?? '—'}</div>
          <div className="text-muted truncate">{me.email ?? '—'}</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="pill pill-leave">{role}</span>
            {me.companyName && <span className="pill pill-present">{me.companyName}</span>}
          </div>
        </div>
      </div>

      {/* Personal attendance snapshot */}
      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-3 mb-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface p-5">
              <Skeleton className="h-2.5 w-20 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 mb-5">
          <StatTile label={`Present in ${year}`} value={present} accent="#34d399" />
          <StatTile label={`Absent in ${year}`} value={absent} accent="#f87171" />
          <StatTile label="Attendance rate" value={rate == null ? '—' : `${rate}%`} accent="#a78bfa" />
        </div>
      )}

      {/* Details + quick links */}
      <div className="grid gap-5 md:grid-cols-2">
        <SectionCard title="Details">
          <dl className="text-sm -mt-1">
            {[
              ['Name', me.name ?? '—'],
              ['Email', me.email ?? '—'],
              ['Company', me.companyName ?? '—'],
              ['Role', role],
              ['Shift', shiftText],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5 border-b border-line/50 last:border-0">
                <dt className="text-muted shrink-0">{k}</dt>
                <dd className="font-medium text-right truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
        <SectionCard title="Quick links">
          <Link href="/my-attendance" className="surface-2 surface-hover p-4 flex items-center gap-3 group">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/12 text-accent ring-1 ring-accent/20 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /><path d="m9 15 2 2 4-4" /></svg>
            </span>
            <div className="min-w-0">
              <div className="font-medium flex items-center gap-1.5">My Attendance <span className="text-muted opacity-0 group-hover:opacity-100 transition">→</span></div>
              <div className="text-muted text-xs">Yearly &amp; monthly present / absent summary</div>
            </div>
          </Link>
          <p className="text-muted text-xs mt-4">
            You can only see your own profile and attendance. Company-wide data is restricted to
            managers and owners.
          </p>
        </SectionCard>
      </div>
    </>
  );
}
