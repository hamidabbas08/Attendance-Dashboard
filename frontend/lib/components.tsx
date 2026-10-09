'use client';

import { ReactNode } from 'react';
import { useAuth } from './auth';
import { pillClass, STATUS_META, ui } from './ui';

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={pillClass(status)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status.replace('_', ' ')}
    </span>
  );
}

/** Consistent page header: title, optional description, right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className={ui.h2}>{title}</h1>
        {description && <p className={ui.subtitle}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-end gap-2.5">{actions}</div>}
    </header>
  );
}

/** A titled content card with an optional header row and actions. */
export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`surface ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line/70">
          <div className="min-w-0">
            {title && <h3 className={ui.h3}>{title}</h3>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={`p-5 sm:p-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** A colored status badge (dot + label) driven by the shared status palette. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const meta = STATUS_META[status];
  const text = label ?? meta?.label ?? status.replace('_', ' ');
  const hex = meta?.hex ?? '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `${hex}1f`, color: hex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hex }} />
      {text}
    </span>
  );
}

/** A polished empty state: icon, heading, description, optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-panel2 text-muted ring-1 ring-line">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="font-semibold">{title}</div>
      {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A compact segmented control (used for filter tabs). */
export function SegTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-panel2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
            value === o.value ? 'bg-accent text-ink shadow-sm' : 'text-muted hover:text-fg hover:bg-white/[0.05]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}

/**
 * Round avatar. Initials on a gradient render instantly; when a Slack image is
 * present it loads on top (lazy, cached by the browser) so there is never a
 * blank circle while it downloads.
 */
export function Avatar({ src, name, size = 28 }: { src?: string | null; name: string; size?: number }) {
  return (
    <span
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#38bdf8,#a78bfa)' }}
      className="relative rounded-full flex items-center justify-center text-ink font-semibold shrink-0 overflow-hidden ring-1 ring-white/10"
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(name)}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full rounded-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </span>
  );
}

/** Shimmer placeholder. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-panel2/70 ${className}`} />;
}

/** A small spinning ring, for inline/full-page loading states instead of bare text. */
export function Spinner({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-panel2 border-t-accent ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}

/** A grid of KPI-tile skeletons. */
export function TilesSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-4 mb-5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface p-5">
          <Skeleton className="h-2.5 w-20 mb-3" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

/** A table skeleton inside a card. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface p-5">
      <Skeleton className="h-4 w-40 mb-4" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `2fr ${'1fr '.repeat(cols - 1)}` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
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

/** A KPI tile: accent indicator + label on top, dominant number below. */
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
    <div className="surface surface-hover p-5 relative overflow-hidden">
      {/* subtle accent wash in the corner */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-[0.12] blur-xl"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-2 mb-2.5">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      </div>
      <div className="text-[30px] leading-none font-bold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted/80 mt-1.5">{sub}</div>}
    </div>
  );
}

/** Single-series monthly bar chart (attendance %). Title names the series. */
export function MonthlyBars({ data }: { data: { label: string; value: number | null }[] }) {
  const PLOT = 150; // px height of the plotting area
  return (
    <div className="pl-7 pr-1">
      <div className="relative" style={{ height: PLOT }}>
        {/* horizontal gridlines + y-axis labels */}
        {[100, 75, 50, 25, 0].map((g) => (
          <div
            key={g}
            className="absolute inset-x-0 flex items-center"
            style={{ top: `${((100 - g) / 100) * PLOT}px` }}
          >
            <span className="absolute -left-7 -translate-y-1/2 text-[10px] tabular-nums text-muted/70">{g}</span>
            <div className={`w-full border-t ${g === 0 ? 'border-line' : 'border-line/40'}`} />
          </div>
        ))}
        {/* bars */}
        <div className="absolute inset-0 flex items-end gap-1.5">
          {data.map((d) => (
            <div key={d.label} className="group relative flex-1 h-full flex items-end justify-center">
              {/* faint full-height track so empty months read as "no data" */}
              <div className="absolute bottom-0 w-full max-w-[22px] h-full rounded-md bg-panel2/40" />
              <div
                className="relative w-full max-w-[22px] rounded-t-md bg-gradient-to-t from-accent/70 to-accent transition-[height,filter] duration-150 group-hover:brightness-110"
                style={{ height: `${d.value ?? 0}%`, minHeight: d.value == null ? 0 : 3 }}
              />
              {/* hover tooltip */}
              <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                <div className="rounded-md bg-ink/95 border border-line px-2 py-1 text-[11px] whitespace-nowrap shadow-pop">
                  <span className="text-muted">{d.label}: </span>
                  <span className="font-semibold text-fg">{d.value == null ? 'no data' : `${d.value}%`}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* x-axis labels */}
      <div className="flex gap-1.5 mt-2">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-[10px] text-muted">{d.label}</div>
        ))}
      </div>
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
    <div className="flex flex-col gap-3.5">
      {items.map((i) => (
        <div key={i.k} className="text-sm">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: i.hex }} />
              {i.label}
            </div>
            <div className={`font-semibold tabular-nums ${i.text}`}>{i.n}</div>
          </div>
          <div className="h-2 rounded-full bg-panel2 overflow-hidden ring-1 ring-white/5">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${Math.max((i.n / max) * 100, 4)}%`, background: i.hex }}
              title={`${i.label}: ${i.n}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
