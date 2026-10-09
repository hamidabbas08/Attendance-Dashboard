'use client';

import { useState } from 'react';
import { ui } from '../../lib/ui';
import { MONTHS, WD } from './calc';

// Read-only list of declared holidays, scoped to whatever year/month the grid
// is currently showing — a dropdown instead of a dedicated card, since the
// grid itself already shows each holiday's name on its day now. Creating a
// holiday still happens through the Mark Attendance form above.
export function HolidaysDropdown({
  holidays, year, month,
}: {
  holidays: { date: string; name: string }[]; year: number; month: number | 'all';
}) {
  const [open, setOpen] = useState(false);
  const prefix = month === 'all' ? `${year}-` : `${year}-${String(month + 1).padStart(2, '0')}-`;
  const periodLabel = month === 'all' ? `${year}` : `${MONTHS[month]} ${year}`;
  const sorted = [...holidays]
    .filter((h) => h.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="relative">
      <label className={ui.label}>&nbsp;</label>
      <button
        type="button"
        className={`${ui.btnGhost} !py-2.5 whitespace-nowrap`}
        onClick={() => setOpen((o) => !o)}
      >
        Holidays · {sorted.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-72 max-h-80 overflow-y-auto surface p-3 shadow-xl">
            <div className="text-muted text-xs mb-2">Declared holidays · {periodLabel}</div>
            {sorted.length > 0 ? (
              <div className="flex flex-col divide-y divide-line/50">
                {sorted.map((h) => {
                  const wd = WD[new Date(`${h.date}T00:00:00Z`).getUTCDay()];
                  return (
                    <div key={h.date} className="py-2 text-sm flex items-center justify-between gap-3">
                      <span className="font-semibold whitespace-nowrap">
                        {h.date} <span className="text-muted font-normal">({wd})</span>
                      </span>
                      <span className="text-muted truncate">{h.name}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted text-sm">No holidays declared in {periodLabel}.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
