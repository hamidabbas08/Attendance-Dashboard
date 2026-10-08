'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, EmptyState, Guard, PageHeader, SectionCard, SegTabs, StatusBadge, TableSkeleton } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Employee {
  id: string;
  name: string;
  email: string;
  slackUserId: string | null;
  role: string;
  roles?: string[];
  status: string;
  terminatedAt?: string | null;
  avatarUrl?: string | null;
}

type TeamFilter = 'active' | 'terminated' | 'all';
const FILTERS: { value: TeamFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'all', label: 'All' },
];

const ROLE_OPTIONS = [
  { value: 'company_owner', label: 'Owner' },
  { value: 'company_admin', label: 'Admin' },
  { value: 'cto', label: 'CTO' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'manager', label: 'Manager' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'developer', label: 'Developer' },
  { value: 'business_developer', label: 'Business Developer' },
  { value: 'designer', label: 'Designer' },
  { value: 'employee', label: 'Employee' },
];
const roleLabel = (v: string) => ROLE_OPTIONS.find((o) => o.value === v)?.label ?? v;
const rolesOf = (e: Employee): string[] =>
  e.roles && e.roles.length ? e.roles : e.role ? [e.role] : ['employee'];

function Team() {
  const { me, can } = useAuth();
  const employees = useFetch<Employee[]>('/api/employees');
  const [filter, setFilter] = useState<TeamFilter>('active');

  const canRole = can('users:update');

  const loading = employees.loading && !employees.data;
  const all = employees.data ?? [];
  const counts = {
    active: all.filter((e) => e.status === 'active').length,
    terminated: all.filter((e) => e.status === 'terminated').length,
    all: all.length,
  };
  // Filter the roster by the selected tab. "Terminated" people keep their
  // history (and their pre-termination attendance) but drop off the Active list.
  const roster = all.filter((e) =>
    filter === 'all' ? true : filter === 'terminated' ? e.status === 'terminated' : e.status === 'active',
  );

  return (
    <>
      <PageHeader
        title="Team"
        description="Manage people, roles and access. The roster mirrors your Slack #attendance channel."
        actions={
          <SegTabs
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((f) => ({ value: f.value, label: <>{f.label} <span className="opacity-60">· {counts[f.value]}</span></> }))}
          />
        }
      />

      {loading ? (
        <TableSkeleton rows={8} cols={4} />
      ) : (
        <SectionCard bodyClassName="!p-0">
          {roster.length === 0 ? (
            <EmptyState
              title={filter === 'terminated' ? 'No terminated members' : 'No team members yet'}
              description={filter === 'terminated'
                ? 'Members who leave the Slack channel will appear here, with their history preserved.'
                : 'Team members sync automatically from your Slack #attendance channel after they sign in.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th className={ui.th}>Name</th>
                    <th className={ui.th}>Email</th>
                    <th className={ui.th}>Role</th>
                    <th className={ui.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((e) => (
                    <TeamRow
                      key={e.id}
                      employee={e}
                      isSelf={e.id === me?.employeeId}
                      canRole={canRole}
                      onChange={() => employees.reload()}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </>
  );
}

function TeamRow({
  employee, isSelf, canRole, onChange,
}: {
  employee: Employee; isSelf: boolean;
  canRole: boolean; onChange: () => void;
}) {
  const [err, setErr] = useState('');

  async function patch(body: Record<string, unknown>) {
    setErr('');
    try {
      await api(`/api/employees/${employee.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      onChange();
    } catch (e) { setErr((e as ApiError).message); throw e; }
  }

  return (
    <tr className="transition-colors duration-150 hover:bg-white/[0.025]">
      <td className={`${ui.td} whitespace-nowrap`}>
        <div className="flex items-center gap-2.5">
          <Avatar src={employee.avatarUrl} name={employee.name} size={32} />
          <span className="font-medium">
            <Link href={`/employee/${employee.id}`} className="hover:text-accent transition-colors duration-150">
              {employee.name}
            </Link>
            {isSelf && <span className="text-faint font-normal"> (you)</span>}
          </span>
        </div>
      </td>
      <td className={`${ui.td} text-muted`}>{employee.email || '—'}</td>
      <td className={ui.td}>
        {canRole && !isSelf ? (
          <>
            <MultiRoleSelect selected={rolesOf(employee)} onChange={(roles) => patch({ roles })} />
            {err && <div className={ui.error}>{err}</div>}
          </>
        ) : (
          <div className="flex flex-wrap gap-1">
            {rolesOf(employee).map((r) => (
              <span key={r} className="pill pill-leave">{roleLabel(r)}</span>
            ))}
          </div>
        )}
      </td>
      <td className={ui.td}>
        {employee.status === 'terminated' ? (
          <span title={employee.terminatedAt ? `Since ${employee.terminatedAt}` : undefined}>
            <StatusBadge status="absent" label="Terminated" />
          </span>
        ) : (
          <StatusBadge status="present" label="Active" />
        )}
      </td>
    </tr>
  );
}

// A compact multi-select: a dropdown of checkboxes so a person can hold several
// roles/titles at once. Each toggle saves immediately.
//
// The panel is rendered into a portal on <body>, positioned via the trigger's
// own bounding rect, instead of being an in-flow absolutely-positioned child
// of the table row. A row-local absolute child gets clipped by the table's
// horizontal-scroll wrapper (overflow-x-auto implies overflow-y clipping too),
// which is what forced scrolling the table to see the full checkbox list.
function MultiRoleSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (roles: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((r) => r !== value)
      : [...selected, value];
    onChange(next);
  };

  // The panel's max-h-64 + padding caps it at ~280px tall. Open downward by
  // default, but flip above the trigger when there isn't ~280px of room below
  // (and there's more room above) — otherwise it runs off the bottom of the
  // viewport with no page scroll to reach it, as happened near the end of the
  // table.
  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) { setOpen(true); return; }
    const PANEL_H = 280;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < PANEL_H && r.top > spaceBelow;
    setPos(
      openUp
        ? { left: r.left, bottom: window.innerHeight - r.top + 4 }
        : { left: r.left, top: r.bottom + 4 },
    );
    setOpen(true);
  }

  // Close on scroll/resize rather than trying to keep it pinned to the
  // trigger — simplest way to avoid a stale/misaligned panel. Scrolling the
  // panel's own (possibly overflowing) checkbox list must NOT count as a
  // page scroll, or the dropdown closes the moment you try to scroll it.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const summary = selected.length ? selected.map(roleLabel).join(', ') : 'Select roles…';

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`${ui.input} !w-52 cursor-pointer truncate text-left`}
        title={summary}
      >
        {summary}
      </button>
      {open && pos && createPortal(
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="fixed z-50 w-56 max-h-64 overflow-y-auto surface p-2 shadow-xl"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
          >
            {ROLE_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-panel2 cursor-pointer text-sm"
              >
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.USERS_VIEW}>
      <Team />
    </Guard>
  );
}
