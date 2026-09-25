/** Mirror of the backend permission keys (UI convenience only). */
export const P = {
  COMPANY_VIEW: 'company:view',
  EMPLOYEES_VIEW: 'employees:view',
  ATTENDANCE_VIEW_OWN: 'attendance:view_own',
  ATTENDANCE_VIEW_ALL: 'attendance:view_all',
  SHIFTS_VIEW: 'shifts:view',
  ATTENDANCE_RULES_VIEW: 'attendance_rules:view',
  REPORTS_VIEW: 'reports:view',
  SLACK_VIEW: 'slack:view',
  AUDIT_VIEW: 'audit:view',
  CLAUDE_QUERY_OWN: 'claude:query_own',
  PLATFORM_MANAGE: 'platform:manage',
} as const;
