import { botTokenForWorkspace } from '../auth/slackOAuth';
import { TenantRepository } from '../data/repository';
import { store } from '../data/store';
import { SlackWorkspace } from '../data/types';
import { fetchSlackMembers } from './members';

export interface SyncResult {
  imported: number;
  updated: number;
  total: number;
}

/**
 * Pull a workspace's members from Slack and upsert them as employees. Matching:
 * Slack id → exact email → an unclaimed imported row by name (so two different
 * people who share a name stay separate). Used by the manual endpoint, by the
 * background scheduler, and automatically after each Slack login.
 */
export async function syncWorkspaceMembers(workspace: SlackWorkspace): Promise<SyncResult> {
  const token = botTokenForWorkspace(workspace);
  if (!token) return { imported: 0, updated: 0, total: 0 };

  const members = await fetchSlackMembers(token);
  const repo = new TenantRepository(store, { companyId: workspace.companyId, crossTenant: false });
  const roster = repo.listEmployees();
  let imported = 0;
  let updated = 0;
  for (const m of members) {
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
  return { imported, updated, total: members.length };
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
