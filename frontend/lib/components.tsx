'use client';

import { ReactNode } from 'react';
import { useAuth } from './auth';
import { pillClass, STATUS_META, ui } from './ui';

export function StatusPill({ status }: { status: string }) {
  return <span className={pillClass(status)}>{status.replace('_', ' ')}</span>;
}

/** Client-side page guard. UI convenience only — the backend still authorizes. */
export function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return (
      <div className="surface p-5 text-danger">403 — You do not have access to this page.</div>
    );
  }
  return <>{children}</>;
}

/** A KPI tile: big number, label, optional accent bar and sub-text. */
export function StatTile({
  label,
  value,
  sub,
  accent = '#38bdf8',
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="surface p-5 relative overflow-hidden">
      <div className="absolute left-0 top-0 h-full w-1" style={{ background: accent }} />
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      <div className="text-muted text-[13px] mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted/80 mt-1">{sub}</div>}
    </div>
  );
}

/** Single-series monthly bar chart (attendance %). Title names the series. */
export function MonthlyBars({ data }: { data: { label: string; value: number | null }[] }) {
  return (
    <div className="flex items-end gap-2" style={{ height: 160 }}>
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 group">
          <div className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition h-3">
            {d.value == null ? '' : `${d.value}%`}
          </div>
          <div className="w-full flex items-end justify-center" style={{ height: 116 }}>
            <div
              title={`${d.label}: ${d.value == null ? 'no data' : d.value + '%'}`}
              className="w-full max-w-[26px] rounded-md bg-accent/70 group-hover:bg-accent transition-all"
              style={{ height: `${d.value ?? 0}%`, minHeight: d.value == null ? 0 : 3 }}
            />
          </div>
          <div className="text-[10px] text-muted">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Horizontal status distribution bars (reserved status colors + labels). */
export function StatusBars({ counts }: { counts: Record<string, number> }) {
  const keys = ['present', 'late', 'absent', 'leave', 'half_day', 'off_day', 'holiday'];
  const items = keys
    .map((k) => ({ k, n: counts[k] ?? 0, ...STATUS_META[k] }))
    .filter((i) => i.n > 0);
  const max = Math.max(1, ...items.map((i) => i.n));
  if (items.length === 0) return <p className={ui.muted}>No records yet.</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((i) => (
        <div key={i.k} className="flex items-center gap-3 text-sm">
          <div className="w-20 shrink-0 text-muted">{i.label}</div>
          <div className="flex-1 h-3 rounded-full bg-panel2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(i.n / max) * 100}%`, background: i.hex }}
              title={`${i.label}: ${i.n}`}
            />
          </div>
          <div className={`w-10 text-right font-semibold ${i.text}`}>{i.n}</div>
        </div>
      ))}
    </div>
  );
}
