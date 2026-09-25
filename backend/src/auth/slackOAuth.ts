import { randomBytes } from 'crypto';
import { config } from '../config/env';
import { store } from '../data/store';
import { UnauthorizedError } from '../errors';
import { issueToken } from './tokens';

/**
 * "Sign in with Slack" (OpenID Connect) flow.
 *
 *   frontend → /api/auth/slack/start → Slack authorize
 *   Slack → /api/auth/slack/callback?code → exchange for identity
 *   identity (team_id, user_id, email) → resolve tenant + user → issue our JWT
 *
 * The tenant is resolved from the Slack team_id (never from client input), so a
 * user can only ever sign into the company their workspace is linked to.
 */

const AUTHORIZE_URL = 'https://slack.com/openid/connect/authorize';
const TOKEN_URL = 'https://slack.com/api/openid.connect.token';
const USERINFO_URL = 'https://slack.com/api/openid.connect.userInfo';

export interface SlackIdentity {
  teamId: string;
  userId: string;
  email: string | null;
  name: string | null;
}

// --- CSRF state store (short-lived, single-use) --------------------------------
const stateStore = new Map<string, number>();
const STATE_TTL_MS = 10 * 60 * 1000;

export function createState(): string {
  const state = randomBytes(16).toString('hex');
  stateStore.set(state, Date.now() + STATE_TTL_MS);
  return state;
}

export function consumeState(state: string | undefined): boolean {
  if (!state) return false;
  const expiry = stateStore.get(state);
  stateStore.delete(state);
  return typeof expiry === 'number' && expiry > Date.now();
}

export function isSlackLoginConfigured(): boolean {
  return Boolean(config.slackClientId && config.slackClientSecret);
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'openid email profile',
    client_id: config.slackClientId,
    state,
    redirect_uri: config.slackOauthRedirectUrl,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchange the OAuth code for the user's Slack identity. */
export async function exchangeCodeForIdentity(code: string): Promise<SlackIdentity> {
  const body = new URLSearchParams({
    client_id: config.slackClientId,
    client_secret: config.slackClientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.slackOauthRedirectUrl,
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenJson = (await tokenRes.json()) as { ok?: boolean; access_token?: string };
  if (!tokenJson.ok || !tokenJson.access_token) {
    throw new UnauthorizedError('Slack token exchange failed');
  }

  const infoRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const info = (await infoRes.json()) as Record<string, unknown> & { ok?: boolean };
  if (!info.ok) {
    throw new UnauthorizedError('Failed to load Slack profile');
  }

  const teamId = String(info['https://slack.com/team_id'] ?? '');
  const userId = String(info['https://slack.com/user_id'] ?? info['sub'] ?? '');
  if (!teamId || !userId) {
    throw new UnauthorizedError('Slack identity missing team or user id');
  }
  return {
    teamId,
    userId,
    email: (info['email'] as string) ?? null,
    name: (info['name'] as string) ?? null,
  };
}

/**
 * Resolve a Slack identity to one of our users and issue a JWT.
 *
 * 1. team_id → linked company (slack_workspaces). No link → rejected.
 * 2. Within that company: match by slack_user_id, else by email.
 * 3. Issue our own JWT for that user. (Isolated + testable, no network.)
 */
export function resolveSlackLogin(identity: SlackIdentity): {
  token: string;
  userId: string;
} {
  const workspace = [...store.slackWorkspaces.values()].find(
    (w) => w.slackTeamId === identity.teamId,
  );
  if (!workspace) {
    throw new UnauthorizedError('This Slack workspace is not linked to a company');
  }
  const companyId = workspace.companyId;

  const users = [...store.users.values()].filter((u) => u.companyId === companyId);
  let user =
    users.find((u) => u.slackUserId && u.slackUserId === identity.userId) ??
    (identity.email
      ? users.find((u) => u.email.toLowerCase() === identity.email!.toLowerCase())
      : undefined);

  if (!user || user.status !== 'active') {
    throw new UnauthorizedError('No active account for this Slack user in this company');
  }

  // Link the Slack user id on first login so future logins match directly.
  if (!user.slackUserId) {
    user.slackUserId = identity.userId;
    user.updatedAt = store.now();
  }

  return { token: issueToken(user.id), userId: user.id };
}
