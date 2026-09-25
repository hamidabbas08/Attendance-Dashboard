import { SlackWorkspace, User } from '../data/types';

/** Never expose password hashes to any client. */
export function serializeUser(user: User) {
  const { passwordHash, ...safe } = user;
  void passwordHash;
  return safe;
}

/** Never expose Slack access tokens to any client. */
export function serializeSlackWorkspace(ws: SlackWorkspace) {
  const { accessToken, ...safe } = ws;
  void accessToken;
  return { ...safe, connected: Boolean(accessToken) };
}
