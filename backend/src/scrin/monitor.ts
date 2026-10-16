import { botTokenForWorkspace } from '../auth/slackOAuth';
import { config } from '../config/env';
import { TenantRepository } from '../data/repository';
import { store } from '../data/store';
import { sendDirectMessage } from '../slack/api';
import { getCommonData } from './client';
import { scrinEnabled } from './service';

/**
 * Watches every linked employee's scrin.io tracking state and reacts to pauses:
 * when someone turns their screen activity OFF (tracking goes offline), we DM
 * them immediately and open a BREAK; when they turn it back on, the break is
 * closed. The paused span therefore counts as that person's break time.
 *
 * Detection is transition-based across polls: scrin.io reports an
 * `activityStatus` per employment ('online' | 'away' | 'offline'). 'offline'
 * means the desktop app is not tracking (paused/closed); 'online'/'away' mean
 * it is running (away = idle but still tracking). We fire on the online/away →
 * offline edge, and resolve on the offline → online/away edge.
 */

// employmentId -> last observed activityStatus, to spot transitions between polls.
const lastStatus = new Map<number, string>();

/** True while the scrin.io desktop app is actively tracking (not paused). */
function isTracking(status: string): boolean {
  return status !== 'offline';
}

const TZ_OFFSET_MS = config.attendanceTzOffsetMinutes * 60 * 1000;
function localHHMM(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000 + TZ_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
function localDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000 + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** Bot token able to DM people in the given company's Slack workspace. */
function tokenForCompany(companyId: string): string {
  const ws = [...store.slackWorkspaces.values()].find((w) => w.companyId === companyId);
  if (ws) return botTokenForWorkspace(ws);
  return config.slackBotToken || '';
}

/**
 * One monitoring pass. Best-effort: any failure (scrin.io or Slack) is swallowed
 * so the scheduler keeps running. Safe to call on an interval.
 */
export async function runScrinMonitor(): Promise<void> {
  if (!scrinEnabled) return;

  const companies = await getCommonData(config.scrinApiKey);
  if (companies.length === 0) return;

  // Map a scrin.io employee email to our own employee record.
  const empByEmail = new Map<string, { id: string; companyId: string; slackUserId: string | null }>();
  for (const e of store.employees.values()) {
    if (e.email) empByEmail.set(e.email.toLowerCase(), { id: e.id, companyId: e.companyId, slackUserId: e.slackUserId });
  }

  const nowSec = Math.floor(Date.now() / 1000);

  for (const company of companies) {
    for (const emp of company.employments) {
      const status = emp.activityStatus || 'offline';
      const prev = lastStatus.get(emp.id);
      lastStatus.set(emp.id, status);

      // First time we see this person: record the baseline, don't fire — we only
      // act on an actual change of state.
      if (prev === undefined || prev === status) continue;

      const match = emp.email ? empByEmail.get(emp.email.toLowerCase()) : undefined;
      if (!match) continue;
      const repo = new TenantRepository(store, { companyId: match.companyId, crossTenant: false });

      if (isTracking(prev) && !isTracking(status)) {
        // PAUSE — tracking was just turned off. Open a break (unless one is
        // already open) and DM the person.
        if (repo.findOpenBreak(match.id)) continue;
        const token = tokenForCompany(match.companyId);
        let notified = false;
        if (token && match.slackUserId) {
          notified = await sendDirectMessage(
            token,
            match.slackUserId,
            `⏸️ *Your screen activity is turned off.*\nYour scrin.io tracking is paused, so this time is being counted as a *break* starting from *${localHHMM(nowSec)}*. Turn tracking back on to end your break.`,
          );
        }
        repo.createBreak({
          employeeId: match.id,
          date: localDate(nowSec),
          source: 'scrin_pause',
          startTs: nowSec,
          startLocal: localHHMM(nowSec),
          notified,
        });
      } else if (!isTracking(prev) && isTracking(status)) {
        // RESUME — tracking turned back on. Close the open break.
        const open = repo.findOpenBreak(match.id);
        if (open) repo.closeBreak(open.id, nowSec, localHHMM(nowSec));
      }
    }
  }
}
