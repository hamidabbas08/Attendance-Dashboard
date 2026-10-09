import { to12h } from '../../lib/ui';
import { Shift } from './calc';

export function ShiftBanner({ shift }: { shift: Shift | null }) {
  return (
    <div className="surface px-5 py-4 mb-5 flex items-center gap-3 flex-wrap">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/12 text-accent ring-1 ring-accent/20 shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      </span>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-faint font-semibold">Your shift</div>
        {shift ? (
          <div className="font-semibold">
            {to12h(shift.startTime)} – {to12h(shift.endTime)}
            <span className="text-muted font-normal"> · {shift.graceMins}m grace{shift.name ? ` · ${shift.name}` : ''}</span>
          </div>
        ) : (
          <div className="text-muted">Not set yet — your HR/owner can assign a shift on the Shifts page.</div>
        )}
      </div>
    </div>
  );
}
