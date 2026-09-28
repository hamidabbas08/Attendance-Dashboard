/** Minimal Slack Web API helpers (best-effort; callers tolerate failure). */

export interface SlackProfile {
  slackUserId: string;
  name: string | null;
  email: string | null;
}

/** Look up a Slack user's profile with a bot token (users.info). */
export async function fetchSlackUser(token: string, userId: string): Promise<SlackProfile | null> {
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as {
      ok?: boolean;
      user?: { real_name?: string; profile?: { real_name?: string; display_name?: string; email?: string } };
    };
    if (!json.ok || !json.user) return null;
    const p = json.user.profile ?? {};
    return {
      slackUserId: userId,
      name: p.real_name || json.user.real_name || p.display_name || null,
      email: p.email || null,
    };
  } catch {
    return null;
  }
}

/** Post a message to a channel with a bot token (chat.postMessage). */
export async function postSlackMessage(token: string, channel: string, text: string): Promise<void> {
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, text }),
    });
  } catch {
    /* best-effort */
  }
}
