import { store } from '../data/store';
import { UnauthorizedError } from '../errors';
import { buildPrincipal, Principal } from '../rbac/principal';
import { highestRole } from '../rbac/roles';
import { verifyPassword } from './passwords';
import { issueToken } from './tokens';

/**
 * Resolve a Principal from a user id, deriving company, roles, and permissions
 * entirely server-side from the database. This is called on EVERY authenticated
 * request so that a disabled user or a role change takes effect immediately.
 */
export function resolvePrincipal(userId: string): Principal {
  const user = store.users.get(userId);
  if (!user || user.status !== 'active') {
    throw new UnauthorizedError('User not found or disabled');
  }
  // Link the user to their employee record. Match by explicit user link, Slack
  // user id, email, or name (covers people imported/synced, and people who
  // switched Slack accounts). When several records match the same person — e.g.
  // a duplicate created after a Slack account switch — pick the one that holds
  // their attendance history so "My Attendance" shows their real data.
  const employees = [...store.employees.values()].filter((e) => e.companyId === user.companyId);
  const nameLc = user.name.toLowerCase();
  const emailLc = user.email ? user.email.toLowerCase() : '';
  const candidates = employees.filter(
    (e) =>
      e.userId === user.id ||
      (!!user.slackUserId && e.slackUserId === user.slackUserId) ||
      (!!emailLc && !!e.email && e.email.toLowerCase() === emailLc) ||
      e.name.toLowerCase() === nameLc,
  );
  const recordCount = (employeeId: string) => {
    let n = 0;
    for (const r of store.attendanceRecords.values()) if (r.employeeId === employeeId) n += 1;
    return n;
  };
  const employee = candidates
    .slice()
    .sort((a, b) => recordCount(b.id) - recordCount(a.id))[0];

  // Effective role = the strongest of the account role and the team (employee)
  // role, so an owner can assign roles to anyone on the team without them
  // needing to have logged in first, and the owner is never demoted.
  const roles = [highestRole([...user.roles, ...(employee?.roles ?? [])])];

  return buildPrincipal({
    userId: user.id,
    companyId: user.companyId,
    roles,
    employeeId: employee?.id ?? null,
  });
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    companyId: string | null;
    roles: string[];
  };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = [...store.users.values()].find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
  // Constant-ish behaviour: always run a verify to reduce user-enumeration signal.
  const hash = user?.passwordHash ?? 'scrypt$00$00';
  const ok = await verifyPassword(password, hash);
  if (!user || !ok || user.status !== 'active') {
    throw new UnauthorizedError('Invalid credentials');
  }
  return {
    token: issueToken(user.id),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      companyId: user.companyId,
      roles: user.roles,
    },
  };
}
