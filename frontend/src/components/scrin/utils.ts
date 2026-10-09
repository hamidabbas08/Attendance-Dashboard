import { ScrinBlock, ScrinScreenshot, ScrinScreenshotApp } from './types';

export function fmtDur(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function thisMonthStr(): string {
  return todayStr().slice(0, 7);
}

// The app with the most foreground time on a screenshot, if any were recorded.
export function topApp(apps: ScrinScreenshotApp[]): string | null {
  if (apps.length === 0) return null;
  return [...apps].sort((a, b) => b.duration - a.duration)[0].applicationName;
}

export function avgLevel(screenshots: ScrinScreenshot[]): number {
  if (screenshots.length === 0) return 0;
  return Math.round(screenshots.reduce((sum, s) => sum + s.activityLevel, 0) / screenshots.length);
}

export function relativeTime(epochSeconds: number): string {
  const diff = Math.max(0, Date.now() / 1000 - epochSeconds);
  if (diff < 90) return 'a minute ago';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

// The 0-23 local hours that have any tracked time on the day, for the 24h
// timeline strip (parsed from each block's own "HH:mm" local labels).
export function activeHoursOf(blocks: ScrinBlock[]): Set<number> {
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

export function hourLabel(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

// Sum of duration grouped by a key, sorted highest first — used for both the
// per-task and per-app breakdowns in the summary card's right-hand list.
export function totalsBy<T>(items: T[], key: (t: T) => string, seconds: (t: T) => number): [string, number][] {
  const m = new Map<string, number>();
  for (const item of items) m.set(key(item), (m.get(key(item)) ?? 0) + seconds(item));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
