import { Permission } from './permissions';
import { isPlatformAdmin, permissionsForRoles, Role } from './roles';

/**
 * The server-derived identity of the caller. This is the ONLY source of truth
 * for who the caller is and what company they belong to. Nothing here is ever
 * taken from the request body, query string, or JWT claims beyond the user id.
 */
export interface Principal {
  userId: string;
  /** null only for the platform admin. */
  companyId: string | null;
  roles: Role[];
  permissions: Set<Permission>;
  isPlatformAdmin: boolean;
  /** For employees: the employee record id they own (self-service scoping). */
  employeeId: string | null;
}

export function buildPrincipal(params: {
  userId: string;
  companyId: string | null;
  roles: Role[];
  employeeId?: string | null;
}): Principal {
  return {
    userId: params.userId,
    companyId: params.companyId,
    roles: params.roles,
    permissions: permissionsForRoles(params.roles),
    isPlatformAdmin: isPlatformAdmin(params.roles),
    employeeId: params.employeeId ?? null,
  };
}
