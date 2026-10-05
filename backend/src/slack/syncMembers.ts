import { botTokenForWorkspace } from '../auth/slackOAuth';
import { config } from '../config/env';
import { TenantRepository } from '../data/repository';
import { store } from '../data/store';
import { SlackWorkspace } from '../data/types';
import { fetchChannelMemberIds, findChannelByName, joinChannel } from './api';
import { fetchSlackMembers } from './members';

export interface SyncResult {
  imported: number;
  updated: number;
  terminated: number;
  total: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Keep the team roster in sync with the #attendance channel membership:
 *  - everyone currently in the channel is an active employee (name/email/avatar
 *    pulled from Slack);
 *  - anyone who has left or been removed from the channel is auto-terminated
 *    (their history is kept; they move to the Terminated filter);
 *  - a rejoiner is reactivated.
 *
 * Matching an imported row: Slack id → exact email → an unclaimed row by name,
 * so two different people who share a name stay separate.
 */
export async function syncWorkspaceMembers(workspace: SlackWorkspace): Promise<SyncResult> {
  const token = botTokenForWorkspace(workspace);
  if (!token) return { imported: 0, updated: 0, terminated: 0, total: 0 };

  const channel = config.slackAttendanceChannel || (await findChannelByName(token, 'attendance'));
  if (!channel) return { imported: 0, updated: 0, terminated: 0, total: 0 };
  await joinChannel(token, channel); // best-effort so we can read membership

  const memberIds = new Set(await fetchChannelMemberIds(token, channel));
  if (memberIds.size === 0) return { imported: 0, updated: 0, terminated: 0, total: 0 };

  // users.list gives names/emails/avatars; keep only those in the channel.
  const all = await fetchSlackMembers(token);
  const channelMembers = all.filter((m) => memberIds.has(m.slackUserId));

  const repo = new TenantRepository(store, { companyId: workspace.companyId, crossTenant: false });
  const roster = repo.listEmployees();
  let imported = 0;
  let updated = 0;

  for (const m of channelMembers) {
    const existing =
      roster.find((e) => e.slackUserId === m.slackUserId) ??
      (m.email ? roster.find((e) => e.email && e.email.toLowerCase() === m.email.toLowerCase()) : undefined) ??
      roster.find((e) => !e.slackUserId && e.name.toLowerCase() === m.name.toLowerCase());
    if (existing) {
      repo.updateEmployee(existing.id, {
        name: m.name,
        email: m.email || existing.email,
        slackUserId: m.slackUserId,
        avatarUrl: m.avatarUrl ?? existing.avatarUrl,
        // Rejoining the channel reactivates a previously terminated member.
        ...(existing.status !== 'active' ? { status: 'active', terminatedAt: null } : {}),
      });
      updated += 1;
    } else {
      repo.createEmployee({
        userId: null,
        shiftId: null,
        slackUserId: m.slackUserId,
        name: m.name,
        email: m.email,
        avatarUrl: m.avatarUrl,
        status: 'active',
      });
      imported += 1;
    }
  }

  // Auto-terminate anyone active (and linked to Slack) who is no longer in the
  // channel — they left or were removed. History is preserved.
  let terminated = 0;
  for (const e of repo.listEmployees()) {
    if (e.status === 'active' && e.slackUserId && !memberIds.has(e.slackUserId)) {
      repo.updateEmployee(e.id, { status: 'terminated', terminatedAt: today() });
      terminated += 1;
    }
  }

  return { imported, updated, terminated, total: channelMembers.length };
}

/** Sync every linked workspace. Best-effort; used by the scheduler. */
export async function syncAllWorkspaces(): Promise<void> {
  for (const workspace of store.slackWorkspaces.values()) {
    try {
      await syncWorkspaceMembers(workspace);
    } catch {
      /* best-effort; keep going */
    }
  }
}
