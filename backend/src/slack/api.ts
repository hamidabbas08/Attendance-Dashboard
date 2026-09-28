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

export interface SlackMessage {
  user?: string;
  text?: string;
  ts: string;
  subtype?: string;
  bot_id?: string;
}

/** Find a channel by name (public + private the bot can see). */
export async function findChannelByName(token: string, name: string): Promise<string | null> {
  try {
    let cursor = '';
    do {
      const url = `https://slack.com/api/conversations.list?limit=200&types=public_channel,private_channel${
        cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
      }`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = (await res.json()) as {
        ok?: boolean;
        channels?: { id: string; name: string }[];
        response_metadata?: { next_cursor?: string };
      };
      if (!json.ok) return null;
      const hit = (json.channels ?? []).find((c) => c.name === name);
      if (hit) return hit.id;
      cursor = json.response_metadata?.next_cursor ?? '';
    } while (cursor);
  } catch {
    /* ignore */
  }
  return null;
}

/** Join a public channel (best-effort) so the bot can read its history. */
export async function joinChannel(token: string, channel: string): Promise<void> {
  try {
    await fetch('https://slack.com/api/conversations.join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel }),
    });
  } catch {
    /* best-effort */
  }
}

/** The bot's own Slack user id (auth.test) — used to spot its own posts. */
export async function fetchBotUserId(token: string): Promise<string | null> {
  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as { ok?: boolean; user_id?: string };
    return json.ok ? json.user_id ?? null : null;
  } catch {
    return null;
  }
}

/**
 * Delete a message the bot itself posted (chat.delete). This removes an existing
 * message — it never posts anything to the channel. Returns true on success.
 */
export async function deleteSlackMessage(token: string, channel: string, ts: string): Promise<boolean> {
  try {
    const res = await fetch('https://slack.com/api/chat.delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, ts }),
    });
    const json = (await res.json()) as { ok?: boolean };
    return Boolean(json.ok);
  } catch {
    return false;
  }
}

/** Read a channel's messages since `oldest` (epoch seconds string). */
export async function fetchChannelHistory(
  token: string,
  channel: string,
  oldest?: string,
): Promise<SlackMessage[]> {
  try {
    const url = `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel)}&limit=200${
      oldest ? `&oldest=${encodeURIComponent(oldest)}` : ''
    }`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = (await res.json()) as { ok?: boolean; messages?: SlackMessage[] };
    if (!json.ok) return [];
    return json.messages ?? [];
  } catch {
    return [];
  }
}
