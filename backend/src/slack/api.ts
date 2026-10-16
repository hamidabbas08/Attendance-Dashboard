/** Minimal Slack Web API helpers (best-effort; callers tolerate failure). */

export interface SlackProfile {
  slackUserId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/** Look up a Slack user's profile with a bot token (users.info). */
export async function fetchSlackUser(token: string, userId: string): Promise<SlackProfile | null> {
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as {
      ok?: boolean;
      user?: {
        real_name?: string;
        profile?: {
          real_name?: string;
          display_name?: string;
          email?: string;
          image_192?: string;
          image_72?: string;
        };
      };
    };
    if (!json.ok || !json.user) return null;
    const p = json.user.profile ?? {};
    return {
      slackUserId: userId,
      name: p.real_name || json.user.real_name || p.display_name || null,
      email: p.email || null,
      avatarUrl: p.image_192 || p.image_72 || null,
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

/** All member user-ids of a channel (conversations.members, paginated). */
export async function fetchChannelMemberIds(token: string, channel: string): Promise<string[]> {
  const out: string[] = [];
  let cursor = '';
  try {
    do {
      const url = `https://slack.com/api/conversations.members?channel=${encodeURIComponent(channel)}&limit=200${
        cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
      }`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = (await res.json()) as {
        ok?: boolean;
        members?: string[];
        response_metadata?: { next_cursor?: string };
      };
      if (!json.ok) break;
      out.push(...(json.members ?? []));
      cursor = json.response_metadata?.next_cursor ?? '';
    } while (cursor);
  } catch {
    /* best-effort */
  }
  return out;
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

/**
 * Send a direct message (DM) to a single Slack user via the bot token.
 * Opens (or reuses) the 1:1 conversation with `conversations.open`, then posts
 * with `chat.postMessage`. This ONLY ever messages the individual user — never
 * a channel — and is best-effort (returns false on any failure).
 * Requires the bot scopes `chat:write` and `im:write`.
 */
export async function sendDirectMessage(
  token: string,
  slackUserId: string,
  text: string,
): Promise<boolean> {
  try {
    const openRes = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ users: slackUserId }),
    });
    const open = (await openRes.json()) as { ok?: boolean; channel?: { id?: string } };
    const channel = open.ok ? open.channel?.id : undefined;
    if (!channel) return false;

    const postRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, text }),
    });
    const post = (await postRes.json()) as { ok?: boolean };
    return Boolean(post.ok);
  } catch {
    return false;
  }
}
