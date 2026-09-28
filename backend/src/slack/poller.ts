import { botTokenForWorkspace } from '../auth/slackOAuth';
import { config } from '../config/env';
import { store } from '../data/store';
import { SlackWorkspace } from '../data/types';
import { fetchChannelHistory, findChannelByName, joinChannel } from './api';
import { isProcessableMessage, recordMessage } from './eventHandler';

// Per-workspace bookkeeping so we only process new messages and don't re-scan.
const lastTsByWorkspace = new Map<string, string>();
const channelIdByWorkspace = new Map<string, string>();

async function resolveChannelId(workspace: SlackWorkspace, token: string): Promise<string | null> {
  const cached = channelIdByWorkspace.get(workspace.id);
  if (cached) return cached;
  // Prefer an explicitly configured channel; else find one named "attendance".
  const id = config.slackAttendanceChannel || (await findChannelByName(token, 'attendance'));
  if (id) {
    channelIdByWorkspace.set(workspace.id, id);
    await joinChannel(token, id); // best-effort so we can read history
  }
  return id;
}

/**
 * Pull recent #attendance messages for one workspace and record them. Reliable
 * even when Slack Event Subscriptions are not wired up, because it uses the bot
 * token (the same path that powers "Sync from Slack").
 */
export async function pollWorkspace(workspace: SlackWorkspace): Promise<{ recorded: number; scanned: number }> {
  const token = botTokenForWorkspace(workspace);
  if (!token) return { recorded: 0, scanned: 0 };

  const channel = await resolveChannelId(workspace, token);
  if (!channel) return { recorded: 0, scanned: 0 };

  // First run: look back ~2 days; afterwards, only since the last message seen.
  const oldest =
    lastTsByWorkspace.get(workspace.id) ??
    (Math.floor(Date.now() / 1000) - 2 * 24 * 3600).toString();

  const messages = await fetchChannelHistory(token, channel, oldest);
  // conversations.history returns newest-first; process oldest-first.
  const ordered = [...messages].sort((a, b) => Number(a.ts) - Number(b.ts));

  let recorded = 0;
  let maxTs = Number(oldest);
  for (const m of ordered) {
    maxTs = Math.max(maxTs, Number(m.ts));
    if (!isProcessableMessage(m)) continue;
    const res = await recordMessage(
      workspace,
      { user: m.user as string, text: m.text ?? '', ts: m.ts, channel },
      { confirm: false }, // silent on poll to avoid spamming the channel
    );
    if (res.action === 'recorded') recorded += 1;
  }
  // Advance the cursor just past the newest message seen.
  lastTsByWorkspace.set(workspace.id, (maxTs + 0.000001).toString());
  return { recorded, scanned: ordered.length };
}

/** Poll every linked workspace (used by the scheduler). Best-effort. */
export async function pollAllWorkspaces(): Promise<void> {
  for (const workspace of store.slackWorkspaces.values()) {
    try {
      await pollWorkspace(workspace);
    } catch {
      /* best-effort; keep polling others */
    }
  }
}
