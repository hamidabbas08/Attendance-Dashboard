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

import { useEffect, useMemo, useState } from 'react';
import { EmptyState, SectionCard, Spinner, TableSkeleton } from './components';
import { to12h, ui } from './ui';
import { useFetch } from './useFetch';

interface ScrinOverview {
  configured: boolean;
  linked: boolean;
  lastActive: number | null;
  todaySeconds: number;
  yesterdaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
  activeDays: string[];
}
interface ScrinScreenshotApp {
  fromScreen: boolean;
  duration: number;
  applicationName: string;
}
interface ScrinScreenshot {
  id: number;
  url: string;
  thumbUrl: string;
  takenLocal: string;
  activityLevel: number;
  applications: ScrinScreenshotApp[];
}
interface ScrinBlock {
  note: string | null;
  offline: boolean;
  from: number;
  to: number;
  fromLocal: string;
  toLocal: string;
  screenshots: ScrinScreenshot[];
}
interface ScrinDayActivity {
  configured: boolean;
  linked: boolean;
  totalSeconds: number;
  blocks: ScrinBlock[];
}

function fmtDur(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function thisMonthStr(): string {
  return todayStr().slice(0, 7);
}
// The app with the most foreground time on a screenshot, if any were recorded.
function topApp(apps: ScrinScreenshotApp[]): string | null {
  if (apps.length === 0) return null;
  return [...apps].sort((a, b) => b.duration - a.duration)[0].applicationName;
}
function avgLevel(screenshots: ScrinScreenshot[]): number {
  if (screenshots.length === 0) return 0;
  return Math.round(screenshots.reduce((sum, s) => sum + s.activityLevel, 0) / screenshots.length);
}
function relativeTime(epochSeconds: number): string {
  const diff = Math.max(0, Date.now() / 1000 - epochSeconds);
  if (diff < 90) return 'a minute ago';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

// A small ring gauge for a 0-100 activity level — green/amber/red by
// threshold, mirroring scrin.io's own per-screenshot and per-task indicator
// (it reads as a tiny pie/clock, close enough to a play/pause glyph at this
// size that it's instantly scannable at a glance).
function ActivityGauge({ level, size = 15 }: { level: number; size?: number }) {
  const color = level >= 66 ? '#34d399' : level >= 33 ? '#fbbf24' : '#f87171';
  const r = (size - 2.5) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, level)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-label={`${level}% active`}>
      <title>{level}% active</title>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={`${filled} ${c - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// Four equal-width quartile bars as the per-screenshot activity readout, lit
// left to right by how many 25%-quartiles the level clears (so 100% lights
// all four). All lit bars share one color — green/amber/red by the same
// threshold as ActivityGauge — rather than a fixed rainbow per position.
// Keyed to the filled bar count itself (not a separate threshold on the raw
// level) so the color always matches what's on screen — two cards both
// showing 3 bars could otherwise land on opposite sides of an independent
// threshold and end up different colors for the same bar count.
const BAR_COLOR_BY_FILLED = ['#f87171', '#fb923c', '#fbbf24', '#34d399'];
function ActivityBars({ level }: { level: number }) {
  const clamped = Math.max(0, Math.min(100, level));
  const filled = clamped <= 0 ? 0 : Math.max(1, Math.round(clamped / 25));
  const color = BAR_COLOR_BY_FILLED[filled - 1] ?? BAR_COLOR_BY_FILLED[0];
  return (
    <div className="flex items-center gap-0.5 w-full" title={`${level}% active`}>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-sm transition-colors"
          style={{ backgroundColor: i < filled ? color : 'rgba(255,255,255,0.1)' }}
        />
      ))}
    </div>
  );
}

// A horizontal month strip (like scrin.io's own day picker): prev/next month
// nav, one button per day, a dot under days with any recorded activity.
function DayStrip({
  month, onMonth, date, onDate, activeDays,
}: {
  month: string; onMonth: (m: string) => void; date: string; onDate: (d: string) => void; activeDays: string[];
}) {
  const activeSet = useMemo(() => new Set(activeDays), [activeDays]);
  const [y, m] = month.split('-').map(Number);
  const numDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const today = todayStr();

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    onMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <div className={`${ui.card} !py-3 sticky top-0 z-10`}>
      <div className="flex items-center gap-2 mb-2 px-1">
        <button type="button" className="text-muted hover:text-fg px-1" onClick={() => shiftMonth(-1)}>‹</button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button type="button" className="text-muted hover:text-fg px-1" onClick={() => shiftMonth(1)}>›</button>
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {Array.from({ length: numDays }, (_, i) => i + 1).map((d) => {
          const ds = `${month}-${String(d).padStart(2, '0')}`;
          const wd = new Date(`${ds}T00:00:00Z`).getUTCDay();
          const selected = ds === date;
          const future = ds > today;
          const worked = activeSet.has(ds);
          // Both weekend days read as "off" by default — Saturday only when
          // nothing was actually logged that day, Sunday always (unchanged).
          const isOff = (wd === 0 && !selected) || (wd === 6 && !selected && !worked);
          // A thin divider before each Monday groups the strip into weeks,
          // like a calendar grid, instead of one long undifferentiated row.
          const weekStart = wd === 1 && d !== 1;
          return (
            <div key={ds} className="flex items-stretch gap-1 shrink-0">
              {weekStart && <div className="w-px bg-line self-stretch my-1" />}
              <button
                type="button"
                disabled={future}
                onClick={() => onDate(ds)}
                className={`flex flex-col items-center shrink-0 w-10 py-1.5 rounded-lg border text-xs transition-colors duration-150 ${
                  selected
                    ? 'border-accent bg-accent/10 text-accent'
                    : future
                      ? 'border-transparent text-faint cursor-default'
                      : 'border-transparent text-muted hover:bg-panel2'
                }`}
              >
                <span>{WD[wd]}</span>
                <span className={`font-semibold ${isOff ? 'text-danger' : ''}`}>{d}</span>
                <span className={`mt-0.5 h-1 w-4 rounded-full ${worked ? 'bg-emerald-400' : 'bg-transparent'}`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The 0-23 local hours that have any tracked time on the day, for the 24h
// timeline strip (parsed from each block's own "HH:mm" local labels).
function activeHoursOf(blocks: ScrinBlock[]): Set<number> {
  const hours = new Set<number>();
  for (const b of blocks) {
    const [fh, fm] = b.fromLocal.split(':').map(Number);
    const [th, tm] = b.toLocal.split(':').map(Number);
    const fromMin = fh * 60 + fm;
    const toMin = Math.max(fromMin + 1, th * 60 + tm);
    for (let h = Math.floor(fromMin / 60); h <= Math.floor((toMin - 1) / 60); h++) {
      if (h >= 0 && h <= 23) hours.add(h);
    }
  }
  return hours;
}
function hourLabel(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}
// Sum of duration grouped by a key, sorted highest first — used for both the
// per-task and per-app breakdowns in the summary card's right-hand list.
function totalsBy<T>(items: T[], key: (t: T) => string, seconds: (t: T) => number): [string, number][] {
  const m = new Map<string, number>();
  for (const item of items) m.set(key(item), (m.get(key(item)) ?? 0) + seconds(item));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

interface LightboxShot extends ScrinScreenshot {
  note: string | null;
}

// Full-size screenshot viewer that opens in place, the way scrin.io's own
// viewer does — not a new tab. Shows the time, task note, and top app/site at
// the top, with Esc/←/→ and on-screen arrows to step through the whole day's
// screenshots without closing it.
function ScreenshotLightbox({
  shots, index, onIndex, onClose,
}: {
  shots: LightboxShot[]; index: number; onIndex: (i: number) => void; onClose: () => void;
}) {
  const shot = shots[index];
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      else if (e.key === 'ArrowRight' && index < shots.length - 1) onIndex(index + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, shots.length, onIndex, onClose]);

  // The current image is never cached on first view, so the arrows felt slow —
  // warm the browser's cache for both neighbors as soon as we land on a shot,
  // so by the time the user clicks next/prev it's already loaded.
  useEffect(() => {
    [shots[index - 1], shots[index + 1]].forEach((s) => {
      if (!s) return;
      const img = new window.Image();
      img.src = s.url;
    });
  }, [index, shots]);

  useEffect(() => setLoaded(false), [index]);

  // The lightbox sits on top of the page as an overlay, but without this the
  // page underneath still scrolls with it — lock body scroll while it's open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!shot) return null;
  const app = topApp(shot.applications);

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center px-16 sm:px-24 py-6">
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndex(index - 1);
          }}
          className="absolute left-1 sm:left-4 inset-y-0 flex items-center px-2 sm:px-4 text-white/50 hover:text-white transition-colors text-5xl sm:text-6xl font-thin leading-none"
          aria-label="Previous screenshot"
        >
          ‹
        </button>
      )}

      {/* One bounded modal — the header bar and the image share the same
          frame width, instead of a full-page-width header sitting above a
          narrower, separately-windowed image. */}
      <div className="flex flex-col max-h-full max-w-[82vw]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 shrink-0 bg-black/50 rounded-t-lg border border-b-0 border-white/10">
          <span className="font-semibold">{to12h(shot.takenLocal)}</span>
          <span className="text-white/60 truncate">{shot.note || 'Untitled'}</span>
          {app && <span className="text-white/40 truncate ml-auto mr-3">{app}</span>}
          <ActivityGauge level={shot.activityLevel} size={16} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="relative z-10 ml-2 h-8 w-8 shrink-0 grid place-items-center rounded-full text-white/70 hover:text-white hover:bg-white/10 text-lg leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="relative flex-1 min-h-0">
          <img
            key={`thumb-${shot.id}`}
            src={shot.thumbUrl}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-contain rounded-b-lg border border-t-0 border-white/10 blur-sm scale-105 transition-opacity ${loaded ? 'opacity-0' : 'opacity-70'}`}
          />
          <img
            key={`full-${shot.id}`}
            src={shot.url}
            alt={`Screenshot at ${shot.takenLocal}`}
            onLoad={() => setLoaded(true)}
            className={`max-h-[72vh] max-w-full h-full w-full object-contain rounded-b-lg border border-t-0 border-white/10 shadow-2xl transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Spinner size={28} />
            </div>
          )}
        </div>
      </div>

      {index < shots.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndex(index + 1);
          }}
          className="absolute right-1 sm:right-4 inset-y-0 flex items-center px-2 sm:px-4 text-white/50 hover:text-white transition-colors text-5xl sm:text-6xl font-thin leading-none"
          aria-label="Next screenshot"
        >
          ›
        </button>
      )}
    </div>
  );
}

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
