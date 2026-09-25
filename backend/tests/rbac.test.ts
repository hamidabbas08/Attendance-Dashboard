import { can, sameTenant } from '../src/rbac/can';
import { PERMISSIONS } from '../src/rbac/permissions';
import { buildPrincipal } from '../src/rbac/principal';
import { permissionsForRoles, ROLES } from '../src/rbac/roles';

describe('RBAC role → permission matrix', () => {
  it('gives the platform admin every permission', () => {
    const perms = permissionsForRoles([ROLES.PLATFORM_ADMIN]);
    expect(perms.has(PERMISSIONS.PLATFORM_MANAGE)).toBe(true);
    expect(perms.has(PERMISSIONS.EMPLOYEES_DELETE)).toBe(true);
    expect(perms.has(PERMISSIONS.ATTENDANCE_VIEW_ALL)).toBe(true);
  });

  it('restricts employees to their own data only', () => {
    const perms = permissionsForRoles([ROLES.EMPLOYEE]);
    expect(perms.has(PERMISSIONS.ATTENDANCE_VIEW_OWN)).toBe(true);
    expect(perms.has(PERMISSIONS.ATTENDANCE_VIEW_ALL)).toBe(false);
    expect(perms.has(PERMISSIONS.EMPLOYEES_VIEW)).toBe(false);
    expect(perms.has(PERMISSIONS.PLATFORM_MANAGE)).toBe(false);
  });

  it('does NOT let HR touch platform or user management', () => {
    const perms = permissionsForRoles([ROLES.HR_MANAGER]);
    expect(perms.has(PERMISSIONS.EMPLOYEES_CREATE)).toBe(true);
    expect(perms.has(PERMISSIONS.PLATFORM_MANAGE)).toBe(false);
    expect(perms.has(PERMISSIONS.USERS_DELETE)).toBe(false);
  });

  it('lets the founder manage the company but not the platform', () => {
    const perms = permissionsForRoles([ROLES.COMPANY_OWNER]);
    expect(perms.has(PERMISSIONS.COMPANY_UPDATE)).toBe(true);
    expect(perms.has(PERMISSIONS.USERS_CREATE)).toBe(true);
    expect(perms.has(PERMISSIONS.PLATFORM_MANAGE)).toBe(false);
  });
});

describe('can() decision function', () => {
  const employeeA = buildPrincipal({
    userId: 'u1',
    companyId: 'A',
    roles: [ROLES.EMPLOYEE],
    employeeId: 'e1',
  });
  const hrA = buildPrincipal({ userId: 'u2', companyId: 'A', roles: [ROLES.HR_MANAGER] });
  const admin = buildPrincipal({ userId: 'u3', companyId: null, roles: [ROLES.PLATFORM_ADMIN] });

  it('denies a permission the role lacks', () => {
    expect(can(employeeA, PERMISSIONS.ATTENDANCE_VIEW_ALL)).toBe(false);
    expect(can(hrA, PERMISSIONS.ATTENDANCE_VIEW_ALL)).toBe(true);
  });

  it('enforces tenant ownership when a resource is supplied', () => {
    expect(can(hrA, PERMISSIONS.EMPLOYEES_VIEW, { companyId: 'A' })).toBe(true);
    expect(can(hrA, PERMISSIONS.EMPLOYEES_VIEW, { companyId: 'B' })).toBe(false);
  });

  it('lets the platform admin cross tenants', () => {
    expect(can(admin, PERMISSIONS.EMPLOYEES_VIEW, { companyId: 'B' })).toBe(true);
    expect(sameTenant(admin, { companyId: 'anything' })).toBe(true);
  });

  it('denies a non-admin with no company', () => {
    const orphan = buildPrincipal({ userId: 'x', companyId: null, roles: [ROLES.EMPLOYEE] });
    expect(sameTenant(orphan, { companyId: 'A' })).toBe(false);
  });
});
