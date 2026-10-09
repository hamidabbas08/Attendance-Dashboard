'use client';

import { useMemo } from 'react';
import { ui } from '../../lib/ui';
import { todayStr } from './utils';

// A horizontal month strip (like scrin.io's own day picker): prev/next month
// nav, one button per day, a dot under days with any recorded activity.
export function DayStrip({
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
