import Link from 'next/link';
import { CSSProperties } from 'react';
import { Avatar } from '../ui';
import { ui } from '../../lib/ui';
import { cellFor, cellTitle, Employee, LEFT, pendingSignOut, Record, SUMMARY_WIDTH, W, WD } from './calc';

export function AttendanceGrid({
  emps, days, monthGroups, recIndex, earliestRecord, holidayByDate, stretch,
}: {
  emps: Employee[];
  days: string[];
  monthGroups: { label: string; count: number }[];
  recIndex: Map<string, Record>;
  earliestRecord: Map<string, string>;
  holidayByDate: Map<string, string>;
  stretch: boolean;
}) {
  const stickyTh = (left: number, width: number): CSSProperties => ({
    position: 'sticky',
    left,
    minWidth: width,
    width,
    // `position: sticky` cells inside a `border-collapse` table are prone to a
    // Chromium rendering bug where a scrolled-past day column bleeds through
    // to the left of the sticky column during/after a horizontal scroll —
    // `isolation: isolate` gives the cell its own stacking/paint context so
    // nothing from outside it can show through.
    isolation: 'isolate',
    zIndex: 1,
  });
  const dayCell: CSSProperties = stretch ? { minWidth: W.day } : { minWidth: W.day, width: W.day };

  return (
    /*
      Two nested overflow boundaries, not one: Safari/iOS has a documented bug
      where a single `overflow-x: auto` element doesn't reliably clip
      `position: sticky` table cells during/after a scroll gesture — a
      scrolled-past column can visibly bleed past the sticky column's edge.
      An outer `overflow-hidden` wrapper (which also owns the card's rounded
      corners) plus an inner plain `overflow-x-auto` for the actual scrolling
      gives Safari a hard clip it respects, where one boundary alone didn't.
    */
    <div className={`${ui.card} overflow-hidden p-0`}>
      <div className="overflow-x-auto">
        <table
          className="border-collapse text-xs"
          style={stretch ? { width: '100%' } : { minWidth: SUMMARY_WIDTH + days.length * W.day }}
        >
          <thead>
            <tr className="bg-panel">
              <th rowSpan={2} className="text-left px-3 border-b border-line bg-panel" style={stickyTh(LEFT.name, W.name)}>
                Employee
              </th>
              <th rowSpan={2} className="text-muted border-b border-line bg-panel" style={stickyTh(LEFT.present, W.present)}>
                Present
              </th>
              <th rowSpan={2} className="text-muted border-b border-line bg-panel" style={stickyTh(LEFT.absent, W.absent)}>
                Absent
              </th>
              <th rowSpan={2} className="text-muted border-b border-line bg-panel border-r-2 border-r-line" style={stickyTh(LEFT.pct, W.pct)}>
                %
              </th>
              {monthGroups.map((g, i) => (
                <th key={i} colSpan={g.count} className="text-muted font-semibold border-b border-l border-line py-1">
                  {g.label}
                </th>
              ))}
            </tr>
            <tr className="bg-panel">
              {days.map((d) => {
                const dt = new Date(`${d}T00:00:00Z`);
                const first = d.slice(8, 10) === '01';
                const sun = dt.getUTCDay() === 0;
                return (
                  <th
                    key={d}
                    className={`font-normal border-b border-line py-1 ${first ? 'border-l-2 border-l-line' : 'border-l border-line'} ${sun ? 'text-accent' : 'text-muted'}`}
                    style={dayCell}
                  >
                    <div>{String(dt.getUTCDate()).padStart(2, '0')}</div>
                    <div className="text-[10px]">{WD[dt.getUTCDay()]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {emps.map((e, idx) => {
              let present = 0;
              let absent = 0;
              // Attendance starts from the day the employee joined. Use the
              // earliest of their stored join date and any record we have for
              // them, so no history is ever hidden.
              const createdDate = (e.createdAt || '').slice(0, 10);
              const firstRec = earliestRecord.get(e.id);
              const joinDate = [createdDate, firstRec].filter(Boolean).sort()[0] || undefined;
              const cells = days.map((d) => {
                const beforeJoin = joinDate ? d < joinDate : false;
                const rec = recIndex.get(`${e.id}|${d}`);
                const hol = holidayByDate.get(d);
                // Worked time counts as present even on a holiday; absences on a
                // holiday don't count (it's a day off). A still-open shift today
                // (no sign-out yet) is pending — not counted present until sign-out.
                // Days before joining are ignored entirely.
                if (!beforeJoin) {
                  if ((rec?.status === 'present' || rec?.status === 'late') && !pendingSignOut(d, rec)) present += 1;
                  if (!hol && rec?.status === 'absent') absent += 1;
                }
                const cell = cellFor(d, rec, hol);
                return { d, ...cell, title: cellTitle(e.name, d, cell.t, rec, hol) };
              });
              const pct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
              const rowBg = idx % 2 ? 'bg-panel' : 'bg-panel2/40';
              const stickyBg = idx % 2 ? 'bg-panel' : 'bg-[#16243a]';
              return (
                <tr key={e.id} className={rowBg}>
                  <td className={`px-3 py-1.5 border-b border-line whitespace-nowrap ${stickyBg}`} style={stickyTh(LEFT.name, W.name)}>
                    <div className="flex items-center gap-2">
                      <Avatar src={e.avatarUrl} name={e.name} size={22} />
                      <Link href={`/employee/${e.id}`} className="truncate hover:text-accent transition-colors duration-150">
                        {e.name}
                      </Link>
                    </div>
                  </td>
                  <td className={`text-center py-1.5 border-b border-line font-semibold text-emerald-300 ${stickyBg}`} style={stickyTh(LEFT.present, W.present)}>
                    {present}
                  </td>
                  <td className={`text-center py-1.5 border-b border-line font-semibold text-danger ${stickyBg}`} style={stickyTh(LEFT.absent, W.absent)}>
                    {absent}
                  </td>
                  <td className={`text-center py-1.5 border-b border-line border-r-2 border-r-line ${stickyBg}`} style={stickyTh(LEFT.pct, W.pct)}>
                    {pct}%
                  </td>
                  {cells.map((c) => {
                    const first = c.d.slice(8, 10) === '01';
                    return (
                      <td
                        key={c.d}
                        title={c.title}
                        className={`text-center border-b border-line ${first ? 'border-l-2 border-l-line' : 'border-l border-line'} ${c.cls}`}
                        style={{ ...dayCell, height: 26 }}
                      >
                        {c.t}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {emps.length === 0 && (
              <tr>
                <td className="px-3 py-5 text-muted" colSpan={4 + days.length}>
                  No employees yet — workspace members sync from Slack automatically after login.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
