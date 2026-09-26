import { randomBytes } from 'crypto';
import { config } from '../config/env';
import { importAttendanceInto } from '../data/importSeed';
import { store } from '../data/store';
import { User } from '../data/types';
import { AppError, UnauthorizedError } from '../errors';
import { ROLES } from '../rbac/roles';
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
  teamName: string | null;
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

/**
 * The bot token to use for a workspace: its stored token, else the env-provided
 * SLACK_BOT_TOKEN when it belongs to the configured team (or no team is pinned).
 * This lets a single-company deployment configure Slack entirely via env.
 */
export function botTokenForWorkspace(ws: { slackTeamId: string; accessToken: string }): string {
  if (ws.accessToken) return ws.accessToken;
  if (config.slackBotToken && (!config.slackTeamId || config.slackTeamId === ws.slackTeamId)) {
    return config.slackBotToken;
  }
  return '';
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
    teamName:
      (info['https://slack.com/team_name'] as string) ??
      (info['https://slack.com/team_domain'] as string) ??
      null,
  };
}

/**
 * Resolve a Slack identity to one of our users and issue a JWT.
 *
 * 1. team_id → linked company (slack_workspaces).
 * 2. Within that company: match by slack_user_id, else by email.
 * 3. Issue our own JWT for that user. (Isolated + testable, no network.)
 *
 * When auto-provisioning is enabled (default), an unlinked workspace creates a
 * new company whose first user is the owner, and later members auto-join that
 * same company as employees. Each new company is fully isolated, so this only
 * onboards new tenants — it never grants access to an existing one's data.
 */
export function resolveSlackLogin(
  identity: SlackIdentity,
  opts?: { autoProvision?: boolean },
): { token: string; userId: string } {
  const autoProvision = opts?.autoProvision ?? config.slackAutoProvision;

  const workspace = [...store.slackWorkspaces.values()].find(
    (w) => w.slackTeamId === identity.teamId,
  );

  if (!workspace) {
    if (!autoProvision) {
      throw new AppError(
        401,
        'This Slack workspace is not linked to a company',
        'workspace_not_linked',
      );
    }
    const owner = provisionCompanyWithOwner(identity);
    return { token: issueToken(owner.id), userId: owner.id };
  }

  // Backfill the bot token from env if the workspace has none stored yet.
  if (!workspace.accessToken && config.slackBotToken) {
    workspace.accessToken = botTokenForWorkspace(workspace);
  }

  const companyId = workspace.companyId;
  const users = [...store.users.values()].filter((u) => u.companyId === companyId);
  let user =
    users.find((u) => u.slackUserId && u.slackUserId === identity.userId) ??
    (identity.email
      ? users.find((u) => u.email.toLowerCase() === identity.email!.toLowerCase())
      : undefined);

  if (!user) {
    if (!autoProvision) {
      throw new AppError(
        401,
        'No active account for this Slack user in this company',
        'no_account',
      );
    }
    user = provisionEmployee(companyId, identity);
  }

  if (user.status !== 'active') {
    throw new AppError(401, 'This account is disabled', 'account_disabled');
  }

  // Link the Slack user id on first login so future logins match directly.
  if (!user.slackUserId) {
    user.slackUserId = identity.userId;
    user.updatedAt = store.now();
  }

  return { token: issueToken(user.id), userId: user.id };
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'company'
  );
}

// Slack-only accounts have no password; store a hash that can never verify.
const UNUSABLE_PASSWORD = 'slack-oauth$no-password';

/** Create a brand-new, isolated company, link the workspace, and add the owner. */
function provisionCompanyWithOwner(identity: SlackIdentity): User {
  const now = store.now();
  const companyName = identity.teamName || 'My Company';

  const companyId = store.id();
  store.companies.set(companyId, {
    id: companyId,
    name: companyName,
    slug: `${slugify(companyName)}-${companyId.slice(0, 6)}`,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  const wsId = store.id();
  store.slackWorkspaces.set(wsId, {
    id: wsId,
    companyId,
    slackTeamId: identity.teamId,
    workspaceName: config.slackWorkspaceName || companyName,
    // Prefer the env-provided bot token so Slack works with no UI step.
    accessToken: botTokenForWorkspace({ slackTeamId: identity.teamId, accessToken: '' }),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  const userId = store.id();
  const owner: User = {
    id: userId,
    companyId,
    slackUserId: identity.userId,
    name: identity.name || 'Owner',
    email: identity.email || `${identity.userId}@${identity.teamId}.slack`,
    passwordHash: UNUSABLE_PASSWORD,
    status: 'active',
    roles: [ROLES.COMPANY_OWNER],
    createdAt: now,
    updatedAt: now,
  };
  store.users.set(userId, owner);

  // Preload the imported spreadsheet attendance into the new company.
  if (config.importAttendance && process.env.NODE_ENV !== 'test') {
    importAttendanceInto(companyId);
  }
  return owner;
}

/** Add a new workspace member to an existing company as an employee. */
function provisionEmployee(companyId: string, identity: SlackIdentity): User {
  const now = store.now();
  const userId = store.id();
  const user: User = {
    id: userId,
    companyId,
    slackUserId: identity.userId,
    name: identity.name || 'Employee',
    email: identity.email || `${identity.userId}@${identity.teamId}.slack`,
    passwordHash: UNUSABLE_PASSWORD,
    status: 'active',
    roles: [ROLES.EMPLOYEE],
    createdAt: now,
    updatedAt: now,
  };
  store.users.set(userId, user);

  const empId = store.id();
  store.employees.set(empId, {
    id: empId,
    companyId,
    userId,
    shiftId: null,
    slackUserId: identity.userId,
    name: user.name,
    email: user.email,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  return user;
}
