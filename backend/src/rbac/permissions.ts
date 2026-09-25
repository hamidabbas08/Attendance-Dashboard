/**
 * Granular permission catalogue.
 *
 * The application authorizes on these permission strings — NEVER on raw role
 * names. This is the single source of truth for what actions exist.
 */
export const PERMISSIONS = {
  COMPANY_VIEW: 'company:view',
  COMPANY_UPDATE: 'company:update',

  EMPLOYEES_VIEW: 'employees:view',
  EMPLOYEES_CREATE: 'employees:create',
  EMPLOYEES_UPDATE: 'employees:update',
  EMPLOYEES_DELETE: 'employees:delete',

  ATTENDANCE_VIEW_OWN: 'attendance:view_own',
  ATTENDANCE_VIEW_ALL: 'attendance:view_all',
  ATTENDANCE_UPDATE: 'attendance:update',

  ATTENDANCE_RULES_VIEW: 'attendance_rules:view',
  ATTENDANCE_RULES_CREATE: 'attendance_rules:create',
  ATTENDANCE_RULES_UPDATE: 'attendance_rules:update',

  SHIFTS_VIEW: 'shifts:view',
  SHIFTS_CREATE: 'shifts:create',
  SHIFTS_UPDATE: 'shifts:update',

  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',

  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  SLACK_VIEW: 'slack:view',
  SLACK_CONFIGURE: 'slack:configure',

  AUDIT_VIEW: 'audit:view',

  CLAUDE_QUERY_OWN: 'claude:query_own',
  CLAUDE_QUERY_ALL: 'claude:query_all',

  PLATFORM_MANAGE: 'platform:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);
