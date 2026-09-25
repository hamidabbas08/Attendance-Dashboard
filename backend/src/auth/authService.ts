import { store } from '../data/store';
import { UnauthorizedError } from '../errors';
import { buildPrincipal, Principal } from '../rbac/principal';
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
  const employee = [...store.employees.values()].find((e) => e.userId === user.id);
  return buildPrincipal({
    userId: user.id,
    companyId: user.companyId,
    roles: user.roles,
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
