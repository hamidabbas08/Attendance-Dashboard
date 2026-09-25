import { AppError } from '../errors';

export interface SlackMember {
  slackUserId: string;
  name: string;
  email: string;
}

interface RawSlackMember {
  id?: string;
  name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: { real_name?: string; display_name?: string; email?: string };
}

/** Keep only real humans and normalise them. Pure + unit-tested. */
export function mapSlackMembers(raw: RawSlackMember[]): SlackMember[] {
  return raw
    .filter((m) => m && m.id && !m.is_bot && !m.deleted && m.id !== 'USLACKBOT')
    .map((m) => ({
      slackUserId: m.id as string,
      name: m.profile?.real_name || m.profile?.display_name || m.name || (m.id as string),
      email: m.profile?.email || '',
    }));
}

/**
 * Fetch a workspace's members from Slack using its bot token, following
 * pagination. The token is read from the tenant's stored slack_workspace row —
 * never from the client.
 */
export async function fetchSlackMembers(token: string): Promise<SlackMember[]> {
  const out: SlackMember[] = [];
  let cursor = '';
  do {
    const url = `https://slack.com/api/users.list?limit=200${
      cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
    }`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      members?: RawSlackMember[];
      response_metadata?: { next_cursor?: string };
    };
    if (!json.ok) {
      throw new AppError(400, `Slack API error: ${json.error ?? 'unknown'}`, 'slack_api_error');
    }
    out.push(...mapSlackMembers(json.members ?? []));
    cursor = json.response_metadata?.next_cursor ?? '';
  } while (cursor);
  return out;
}
