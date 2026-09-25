import { ALL_PERMISSIONS, Permission, PERMISSIONS as P } from './permissions';

/**
 * The four system roles. Non-platform roles are always scoped to a single company.
 */
export const ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  COMPANY_OWNER: 'company_owner',
  HR_MANAGER: 'hr_manager',
  EMPLOYEE: 'employee',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);

/**
 * The role → permission matrix. Defined in exactly ONE place.
 *
 * Changing what a role can do happens here and nowhere else — there are no
 * `if (role === 'admin')` checks scattered through the codebase.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Platform admin implicitly holds every permission (cross-tenant superuser).
  [ROLES.PLATFORM_ADMIN]: [...ALL_PERMISSIONS],

  [ROLES.COMPANY_OWNER]: [
    P.COMPANY_VIEW,
    P.COMPANY_UPDATE,
    P.EMPLOYEES_VIEW,
    P.EMPLOYEES_CREATE,
    P.EMPLOYEES_UPDATE,
    P.EMPLOYEES_DELETE,
    P.USERS_VIEW,
    P.USERS_CREATE,
    P.USERS_UPDATE,
    P.USERS_DELETE,
    P.ATTENDANCE_VIEW_OWN,
    P.ATTENDANCE_VIEW_ALL,
    P.ATTENDANCE_UPDATE,
    P.ATTENDANCE_RULES_VIEW,
    P.ATTENDANCE_RULES_CREATE,
    P.ATTENDANCE_RULES_UPDATE,
    P.SHIFTS_VIEW,
    P.SHIFTS_CREATE,
    P.SHIFTS_UPDATE,
    P.REPORTS_VIEW,
    P.REPORTS_EXPORT,
    P.SLACK_VIEW,
    P.SLACK_CONFIGURE,
    P.AUDIT_VIEW,
    P.CLAUDE_QUERY_OWN,
    P.CLAUDE_QUERY_ALL,
  ],

  [ROLES.HR_MANAGER]: [
    P.COMPANY_VIEW,
    P.EMPLOYEES_VIEW,
    P.EMPLOYEES_CREATE,
    P.EMPLOYEES_UPDATE,
    P.EMPLOYEES_DELETE,
    P.ATTENDANCE_VIEW_OWN,
    P.ATTENDANCE_VIEW_ALL,
    P.ATTENDANCE_UPDATE,
    P.ATTENDANCE_RULES_VIEW,
    P.ATTENDANCE_RULES_CREATE,
    P.ATTENDANCE_RULES_UPDATE,
    P.SHIFTS_VIEW,
    P.SHIFTS_CREATE,
    P.SHIFTS_UPDATE,
    P.REPORTS_VIEW,
    P.REPORTS_EXPORT,
    P.CLAUDE_QUERY_OWN,
    P.CLAUDE_QUERY_ALL,
  ],

  [ROLES.EMPLOYEE]: [
    P.ATTENDANCE_VIEW_OWN,
    P.CLAUDE_QUERY_OWN,
  ],
};

/** Resolve the union of permissions for a set of roles. */
export function permissionsForRoles(roles: Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const perm of ROLE_PERMISSIONS[role] ?? []) {
      set.add(perm);
    }
  }
  return set;
}

export function isPlatformAdmin(roles: Role[]): boolean {
  return roles.includes(ROLES.PLATFORM_ADMIN);
}
