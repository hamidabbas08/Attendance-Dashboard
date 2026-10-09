'use client';

// Time tracked, app/site activity, and screenshots pulled from scrin.io — a
// secondary data source from a separate product. Mirrors scrin.io's own
// employee dashboard: month nav + day-picker strip, a day-summary card (big
// number, Week/Month inline, a Tasks/Apps & URLs breakdown with bars), a 24h
// timeline, and the selected day's activity as task blocks with screenshots.
//
// Shared between the admin employee page (/employee/[id], any employeeId —
// gated server-side by attendance:view_all) and the self-service My
// Attendance page (employeeId is always the caller's own — attendance:view_own
// is enough there; see backend/src/modules/scrin.routes.ts).

import { useMemo, useState } from 'react';
import { EmptyState, SectionCard, TableSkeleton } from '../ui';
import { to12h, ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';
import { ActivityBars } from './ActivityBars';
import { ActivityGauge } from './ActivityGauge';
import { DayStrip } from './DayStrip';
import { ScreenshotLightbox } from './ScreenshotLightbox';
import { LightboxShot, ScrinDayActivity, ScrinOverview } from './types';
import { activeHoursOf, avgLevel, fmtDur, hourLabel, relativeTime, thisMonthStr, todayStr, topApp, totalsBy } from './utils';

export function ScreenActivityTab({ employeeId }: { employeeId: string }) {
  const [month, setMonth] = useState(thisMonthStr());
  const [date, setDate] = useState(todayStr());
  const [rightTab, setRightTab] = useState<'tasks' | 'apps'>('tasks');
  const overview = useFetch<ScrinOverview>(`/api/scrin/overview?employeeId=${employeeId}&month=${month}`);
  const day = useFetch<ScrinDayActivity>(`/api/scrin/activity?employeeId=${employeeId}&date=${date}`);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const blocks = day.data?.blocks ?? [];
  const screenshots = useMemo(() => blocks.flatMap((b) => b.screenshots), [blocks]);
  // Flattened in display order, with each shot's own task note attached — lets
  // the lightbox step through the whole day (not just one block) with ←/→.
  const allShots = useMemo<LightboxShot[]>(
    () => blocks.flatMap((b) => b.screenshots.map((s) => ({ ...s, note: b.note }))),
    [blocks],
  );
  const taskTotals = useMemo(
    () => totalsBy(blocks, (b) => b.note || 'Untitled', (b) => b.to - b.from),
    [blocks],
  );
  const appTotals = useMemo(
    () => totalsBy(screenshots.flatMap((s) => s.applications), (a) => a.applicationName, (a) => a.duration),
    [screenshots],
  );
  const activeHours = useMemo(() => activeHoursOf(blocks), [blocks]);
  const rightList = rightTab === 'tasks' ? taskTotals : appTotals;
  const maxRight = rightList[0]?.[1] ?? 1;

  // Task totals can sum several non-contiguous blocks under one label — clicking
  // the label scrolls to the first matching block further down the page.
  const firstBlockIndexByLabel = useMemo(() => {
    const m = new Map<string, number>();
    blocks.forEach((b, i) => {
      const label = b.note || 'Untitled';
      if (!m.has(label)) m.set(label, i);
    });
    return m;
  }, [blocks]);
  function scrollToBlock(label: string) {
    const i = firstBlockIndexByLabel.get(label);
    if (i === undefined) return;
    document.getElementById(`activity-block-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const loading = (overview.loading && !overview.data) || (day.loading && !day.data);

  if (loading) return <TableSkeleton rows={4} cols={1} />;
  if (!overview.data?.configured) {
    return (
      <SectionCard>
        <EmptyState
          title="scrin.io isn't connected"
          description="Add SCRIN_IO_API_KEY (the account owner's token) to the backend to enable this tab."
        />
      </SectionCard>
    );
  }
  if (!overview.data.linked) {
    return (
      <SectionCard>
        <EmptyState
          title="No scrin.io account linked"
          description="This person's email doesn't match any employment in your scrin.io account."
        />
      </SectionCard>
    );
  }

  const o = overview.data;
  const dateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  return (
    <>
      {/* position:sticky only has room to "float" for as long as its own
          parent is taller than it — wrapping just the strip on its own left
          nothing to stick through, so it scrolled away immediately. Wrapping
          the whole rest of the tab's content here instead gives it that
          room, so it stays pinned until the user scrolls past everything. */}
      <div>
        <DayStrip month={month} onMonth={setMonth} date={date} onDate={setDate} activeDays={o.activeDays} />

      <div className={`${ui.card} grid sm:grid-cols-2 gap-6 mt-5`}>
        <div>
          <div className="flex items-center gap-2 text-muted text-sm">
            <span>{dateLabel}</span>
            <ActivityGauge level={avgLevel(screenshots)} size={14} />
          </div>
          <div className="text-4xl font-bold mt-1">{fmtDur(day.data?.totalSeconds ?? 0)}</div>
          <div className="text-sm text-muted mt-2">
            Week <span className="text-accent font-semibold">{fmtDur(o.weekSeconds)}</span>
            <span className="mx-1.5">·</span>
            Month <span className="text-accent font-semibold">{fmtDur(o.monthSeconds)}</span>
          </div>
          {o.lastActive && <div className="text-faint text-xs mt-2">Last active {relativeTime(o.lastActive)}</div>}
        </div>
        <div>
          <div className="flex items-center justify-end gap-4 text-sm mb-2.5">
            <button
              type="button"
              onClick={() => setRightTab('tasks')}
              className={rightTab === 'tasks' ? 'text-accent font-semibold' : 'text-muted hover:text-fg'}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setRightTab('apps')}
              className={rightTab === 'apps' ? 'text-accent font-semibold' : 'text-muted hover:text-fg'}
            >
              Apps &amp; URLs
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {rightList.length === 0 && <div className="text-muted text-sm">Nothing tracked for {date}.</div>}
            {rightList.map(([label, secs]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 text-sm rounded-lg px-2.5 py-1.5 odd:bg-white/[0.07]"
              >
                {rightTab === 'tasks' ? (
                  <button
                    type="button"
                    onClick={() => scrollToBlock(label)}
                    className="truncate text-left hover:text-accent transition-colors duration-150"
                  >
                    {label}
                  </button>
                ) : (
                  <span className="truncate">{label}</span>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="tabular-nums text-muted">{fmtDur(secs)}</span>
                  <div className="h-2 w-16 rounded bg-ink/70 overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${Math.round((secs / maxRight) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${ui.card} !py-3 my-5`}>
        <div className="flex gap-0.5 overflow-x-auto">
          {Array.from({ length: 24 }, (_, h) => h).map((h) => (
            <div key={h} className="flex-1 min-w-[26px] text-center">
              <div className={`h-5 rounded-sm ${activeHours.has(h) ? 'bg-emerald-400/70' : 'bg-panel2'}`} />
              <div className="text-[9px] text-faint mt-1">{hourLabel(h)}</div>
            </div>
          ))}
        </div>
      </div>

      {blocks.length === 0 ? (
        <SectionCard>
          <EmptyState title="No activity" description={`Nothing tracked in scrin.io for ${date}.`} />
        </SectionCard>
      ) : (
        <div className="flex flex-col gap-6">
          {blocks.map((b, i) => (
            <div key={i} id={`activity-block-${i}`} className="scroll-mt-28">
              <div className="flex items-center gap-2 mb-4">
                <ActivityGauge level={avgLevel(b.screenshots)} />
                <span className="font-semibold text-sm">
                  {to12h(b.fromLocal)} – {to12h(b.toLocal)}
                </span>
                <span className="text-muted text-sm truncate">{b.note || 'Untitled'}</span>
                {b.offline && <span className="pill pill-absent !text-[10px]">offline</span>}
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {b.screenshots.map((s) => {
                  const app = topApp(s.applications);
                  const shotIndex = allShots.findIndex((x) => x.id === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setLightboxIndex(shotIndex)}
                      className="surface overflow-hidden block text-left hover:ring-1 hover:ring-accent/40 transition-shadow"
                    >
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] bg-panel2">
                        <span className="font-medium whitespace-nowrap">{to12h(s.takenLocal)}</span>
                        {app && <span className="text-muted truncate">{app}</span>}
                      </div>
                      <img src={s.thumbUrl} alt={`Screenshot at ${s.takenLocal}`} className="w-full aspect-video object-cover bg-panel2" />
                      <div className="px-2 py-1.5 bg-panel2">
                        <ActivityBars level={s.activityLevel} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {lightboxIndex !== null && (
        <ScreenshotLightbox
          shots={allShots}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
