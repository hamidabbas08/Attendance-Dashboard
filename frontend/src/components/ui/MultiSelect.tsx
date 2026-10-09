'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ui } from '../../lib/ui';

export interface MultiSelectOption {
  value: string;
  label: string;
}

/**
 * A compact multi-select: a dropdown of checkboxes so several values can be
 * held at once (e.g. a person's roles). Generalized from Team page's old
 * inline `MultiRoleSelect`.
 *
 * The panel is rendered into a portal on <body>, positioned via the trigger's
 * own bounding rect, instead of being an in-flow absolutely-positioned child
 * — a row-local absolute child inside a horizontally-scrolling table gets
 * clipped (overflow-x-auto implies overflow-y clipping too).
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  className,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
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
  // viewport with no page scroll to reach it.
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

  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const summary = selected.length ? selected.map(labelOf).join(', ') : placeholder;

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`${ui.input} cursor-pointer truncate text-left ${className ?? '!w-52'}`}
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
            {options.map((o) => (
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
