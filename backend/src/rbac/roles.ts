import { ALL_PERMISSIONS, Permission, PERMISSIONS as P } from './permissions';

/**
 * System roles. Non-platform roles are always scoped to a single company.
 *
 * The first group are permission tiers (they decide what a person can do). The
 * second group are job titles a company can assign in addition to a tier; each
 * maps to a sensible default permission set, and a person may hold several
 * roles at once (the strongest one wins for access).
 */
export const ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  COMPANY_OWNER: 'company_owner',
  COMPANY_ADMIN: 'company_admin',
  HR_MANAGER: 'hr_manager',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  // Job titles (assignable alongside a tier).
  CTO: 'cto',
  OPERATIONS_MANAGER: 'operations_manager',
  TEAM_LEAD: 'team_lead',
  PRODUCT_MANAGER: 'product_manager',
  DEVELOPER: 'developer',
  BUSINESS_DEVELOPER: 'business_developer',
  DESIGNER: 'designer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);

// Reusable permission sets, so a tier and the job titles that behave like it
// share exactly one definition.
const COMPANY_ADMIN_PERMISSIONS: Permission[] = [
  P.COMPANY_VIEW, P.COMPANY_UPDATE,
  P.EMPLOYEES_VIEW, P.EMPLOYEES_CREATE, P.EMPLOYEES_UPDATE, P.EMPLOYEES_DELETE,
  P.USERS_VIEW, P.USERS_CREATE, P.USERS_UPDATE, P.USERS_DELETE,
  P.ATTENDANCE_VIEW_OWN, P.ATTENDANCE_VIEW_ALL, P.ATTENDANCE_UPDATE,
  P.ATTENDANCE_RULES_VIEW, P.ATTENDANCE_RULES_CREATE, P.ATTENDANCE_RULES_UPDATE,
  P.SHIFTS_VIEW, P.SHIFTS_CREATE, P.SHIFTS_UPDATE,
  P.REPORTS_VIEW, P.REPORTS_EXPORT,
  P.SLACK_VIEW, P.SLACK_CONFIGURE, P.AUDIT_VIEW,
  P.CLAUDE_QUERY_OWN, P.CLAUDE_QUERY_ALL,
];

const HR_MANAGER_PERMISSIONS: Permission[] = [
  P.COMPANY_VIEW,
  P.EMPLOYEES_VIEW, P.EMPLOYEES_CREATE, P.EMPLOYEES_UPDATE, P.EMPLOYEES_DELETE,
  P.ATTENDANCE_VIEW_OWN, P.ATTENDANCE_VIEW_ALL, P.ATTENDANCE_UPDATE,
  P.ATTENDANCE_RULES_VIEW, P.ATTENDANCE_RULES_CREATE, P.ATTENDANCE_RULES_UPDATE,
  P.SHIFTS_VIEW, P.SHIFTS_CREATE, P.SHIFTS_UPDATE,
  P.REPORTS_VIEW, P.REPORTS_EXPORT,
  P.CLAUDE_QUERY_OWN, P.CLAUDE_QUERY_ALL,
];

// Manager / Team lead / Operations manager: sees the team and reports, cannot
// manage users or settings.
const MANAGER_PERMISSIONS: Permission[] = [
  P.COMPANY_VIEW,
  P.EMPLOYEES_VIEW,
  P.ATTENDANCE_VIEW_OWN, P.ATTENDANCE_VIEW_ALL,
  P.ATTENDANCE_RULES_VIEW,
  P.SHIFTS_VIEW,
  P.REPORTS_VIEW, P.REPORTS_EXPORT,
  P.CLAUDE_QUERY_OWN, P.CLAUDE_QUERY_ALL,
];

const OWNER_PERMISSIONS: Permission[] = [...COMPANY_ADMIN_PERMISSIONS];

// Individual contributors (Developer, Designer, Product/Business roles): can see
// only their own attendance, like a plain employee.
const EMPLOYEE_PERMISSIONS: Permission[] = [
  P.ATTENDANCE_VIEW_OWN,
  P.CLAUDE_QUERY_OWN,
];

/**
 * The role → permission matrix. Defined in exactly ONE place.
 *
 * Changing what a role can do happens here and nowhere else — there are no
 * `if (role === 'admin')` checks scattered through the codebase.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Platform admin implicitly holds every permission (cross-tenant superuser).
  [ROLES.PLATFORM_ADMIN]: [...ALL_PERMISSIONS],
  [ROLES.COMPANY_OWNER]: OWNER_PERMISSIONS,
  [ROLES.COMPANY_ADMIN]: COMPANY_ADMIN_PERMISSIONS,
  [ROLES.HR_MANAGER]: HR_MANAGER_PERMISSIONS,
  [ROLES.MANAGER]: MANAGER_PERMISSIONS,
  [ROLES.EMPLOYEE]: EMPLOYEE_PERMISSIONS,
  // Job titles → default permission sets.
  [ROLES.CTO]: COMPANY_ADMIN_PERMISSIONS,
  [ROLES.OPERATIONS_MANAGER]: MANAGER_PERMISSIONS,
  [ROLES.TEAM_LEAD]: MANAGER_PERMISSIONS,
  [ROLES.PRODUCT_MANAGER]: EMPLOYEE_PERMISSIONS,
  [ROLES.DEVELOPER]: EMPLOYEE_PERMISSIONS,
  [ROLES.BUSINESS_DEVELOPER]: EMPLOYEE_PERMISSIONS,
  [ROLES.DESIGNER]: EMPLOYEE_PERMISSIONS,
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
  [ROLES.CTO]: 4,
  [ROLES.HR_MANAGER]: 3,
  [ROLES.MANAGER]: 2,
  [ROLES.OPERATIONS_MANAGER]: 2,
  [ROLES.TEAM_LEAD]: 2,
  [ROLES.EMPLOYEE]: 1,
  [ROLES.PRODUCT_MANAGER]: 1,
  [ROLES.DEVELOPER]: 1,
  [ROLES.BUSINESS_DEVELOPER]: 1,
  [ROLES.DESIGNER]: 1,
};

/** The strongest role among the given candidates (defaults to employee). */
export function highestRole(candidates: (Role | undefined | null)[]): Role {
  const valid = candidates.filter((r): r is Role => !!r && r in ROLE_RANK);
  if (valid.length === 0) return ROLES.EMPLOYEE;
  return valid.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
}

/**
 * Roles a company admin/owner may assign to team members. Ordered as tiers
 * first, then job titles.
 */
export const ASSIGNABLE_ROLES: Role[] = [
  ROLES.COMPANY_OWNER,
  ROLES.COMPANY_ADMIN,
  ROLES.CTO,
  ROLES.HR_MANAGER,
  ROLES.OPERATIONS_MANAGER,
  ROLES.MANAGER,
  ROLES.TEAM_LEAD,
  ROLES.PRODUCT_MANAGER,
  ROLES.DEVELOPER,
  ROLES.BUSINESS_DEVELOPER,
  ROLES.DESIGNER,
  ROLES.EMPLOYEE,
];
