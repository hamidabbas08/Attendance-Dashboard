'use client';

import { SectionCard, StatusBadge } from '../ui';
import { useFetch } from '../../lib/useFetch';

interface Break {
  id: string;
  date: string;
  source: string;
  startTs: number;
  endTs: number | null;
  startLocal: string;
  endLocal: string | null;
}

/** Today's date in PKT (company timezone, UTC+5) — matches the backend. */
function pktToday(): string {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}
function fmtDur(seconds: number): string {
  const m = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

/**
 * Breaks opened when the employee's scrin.io activity was paused. The paused
 * span counts as break time; an ongoing pause shows as live and keeps counting.
 */
export function BreaksCard({ employeeId }: { employeeId?: string }) {
  const today = pktToday();
  // Managers viewing someone else pass employeeId → /api/breaks?employeeId; the
  // employee themselves uses /api/breaks/me.
  const path = employeeId ? `/api/breaks?employeeId=${employeeId}&date=${today}` : `/api/breaks/me?date=${today}`;
  const { data } = useFetch<Break[]>(path);
  const breaks = data ?? [];
  const nowSec = Math.floor(Date.now() / 1000);
  const totalSec = breaks.reduce((s, b) => s + Math.max(0, (b.endTs ?? nowSec) - b.startTs), 0);

  return (
    <SectionCard
      className="mb-5"
      title="Breaks today"
      subtitle="Opened automatically when screen activity (scrin.io) is paused"
      actions={<span className="text-sm font-semibold tabular-nums">{fmtDur(totalSec)} total</span>}
      bodyClassName={breaks.length === 0 ? '' : '!p-0'}
    >
      {breaks.length === 0 ? (
        <p className="text-sm text-muted">
          No breaks today. If you pause your scrin.io tracking, that time is counted here as a break.
        </p>
      ) : (
        <ul className="divide-y divide-line/50">
          {breaks
            .slice()
            .sort((a, b) => a.startTs - b.startTs)
            .map((b) => {
              const ongoing = b.endTs === null;
              const dur = (b.endTs ?? nowSec) - b.startTs;
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums">
                      {b.startLocal} <span className="text-faint">→</span> {ongoing ? 'now' : b.endLocal}
                    </span>
                    {ongoing && <StatusBadge status="late" label="Paused" />}
                  </div>
                  <span className="text-sm text-muted tabular-nums">{fmtDur(dur)}</span>
                </li>
              );
            })}
        </ul>
      )}
    </SectionCard>
  );
}
