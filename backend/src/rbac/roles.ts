import { ALL_PERMISSIONS, Permission, PERMISSIONS as P } from './permissions';

/**
 * The four system roles. Non-platform roles are always scoped to a single company.
 */
export const ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  COMPANY_OWNER: 'company_owner',
  COMPANY_ADMIN: 'company_admin',
  HR_MANAGER: 'hr_manager',
  MANAGER: 'manager',
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

  // Company admin: full control of their own company (same as owner).
  [ROLES.COMPANY_ADMIN]: [
    P.COMPANY_VIEW, P.COMPANY_UPDATE,
    P.EMPLOYEES_VIEW, P.EMPLOYEES_CREATE, P.EMPLOYEES_UPDATE, P.EMPLOYEES_DELETE,
    P.USERS_VIEW, P.USERS_CREATE, P.USERS_UPDATE, P.USERS_DELETE,
    P.ATTENDANCE_VIEW_OWN, P.ATTENDANCE_VIEW_ALL, P.ATTENDANCE_UPDATE,
    P.ATTENDANCE_RULES_VIEW, P.ATTENDANCE_RULES_CREATE, P.ATTENDANCE_RULES_UPDATE,
    P.SHIFTS_VIEW, P.SHIFTS_CREATE, P.SHIFTS_UPDATE,
    P.REPORTS_VIEW, P.REPORTS_EXPORT,
    P.SLACK_VIEW, P.SLACK_CONFIGURE, P.AUDIT_VIEW,
    P.CLAUDE_QUERY_OWN, P.CLAUDE_QUERY_ALL,
  ],

  // Manager / Team lead: sees the team and reports, cannot manage users/settings.
  [ROLES.MANAGER]: [
    P.COMPANY_VIEW,
    P.EMPLOYEES_VIEW,
    P.ATTENDANCE_VIEW_OWN, P.ATTENDANCE_VIEW_ALL,
    P.ATTENDANCE_RULES_VIEW,
    P.SHIFTS_VIEW,
    P.REPORTS_VIEW, P.REPORTS_EXPORT,
    P.CLAUDE_QUERY_OWN, P.CLAUDE_QUERY_ALL,
  ],

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

/** Seniority ranking so we can pick the strongest role a person holds. */
export const ROLE_RANK: Record<Role, number> = {
  [ROLES.PLATFORM_ADMIN]: 6,
  [ROLES.COMPANY_OWNER]: 5,
  [ROLES.COMPANY_ADMIN]: 4,
  [ROLES.HR_MANAGER]: 3,
  [ROLES.MANAGER]: 2,
  [ROLES.EMPLOYEE]: 1,
};

/** The strongest role among the given candidates (defaults to employee). */
export function highestRole(candidates: (Role | undefined | null)[]): Role {
  const valid = candidates.filter((r): r is Role => !!r && r in ROLE_RANK);
  if (valid.length === 0) return ROLES.EMPLOYEE;
  return valid.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
}

/** Roles a company admin/owner may assign to team members. */
export const ASSIGNABLE_ROLES: Role[] = [
  ROLES.COMPANY_OWNER,
  ROLES.COMPANY_ADMIN,
  ROLES.HR_MANAGER,
  ROLES.MANAGER,
  ROLES.EMPLOYEE,
];
