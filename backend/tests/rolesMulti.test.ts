import { normalizeRoles } from '../src/data/repository';
import { PERMISSIONS as P } from '../src/rbac/permissions';
import { highestRole, permissionsForRoles, ROLES } from '../src/rbac/roles';

describe('multi-role support', () => {
  it('picks the strongest role a person holds', () => {
    expect(highestRole([ROLES.DEVELOPER, ROLES.CTO])).toBe(ROLES.CTO);
    expect(highestRole([ROLES.EMPLOYEE, ROLES.TEAM_LEAD])).toBe(ROLES.TEAM_LEAD);
    expect(highestRole([ROLES.DESIGNER, ROLES.MANAGER])).toBe(ROLES.MANAGER);
  });

  it('grants the union of permissions across roles', () => {
    // A designer (IC) plus manager gets the manager's team-wide view.
    const perms = permissionsForRoles([ROLES.DESIGNER, ROLES.MANAGER]);
    expect(perms.has(P.ATTENDANCE_VIEW_ALL)).toBe(true);
    expect(perms.has(P.REPORTS_VIEW)).toBe(true);
  });

  it('keeps job-title ICs at employee-level access', () => {
    for (const r of [ROLES.DEVELOPER, ROLES.DESIGNER, ROLES.PRODUCT_MANAGER, ROLES.BUSINESS_DEVELOPER]) {
      const perms = permissionsForRoles([r]);
      expect(perms.has(P.ATTENDANCE_VIEW_OWN)).toBe(true);
      expect(perms.has(P.ATTENDANCE_VIEW_ALL)).toBe(false);
      expect(perms.has(P.USERS_UPDATE)).toBe(false);
    }
  });

  it('gives CTO company-admin level access', () => {
    const perms = permissionsForRoles([ROLES.CTO]);
    expect(perms.has(P.USERS_UPDATE)).toBe(true);
    expect(perms.has(P.ATTENDANCE_VIEW_ALL)).toBe(true);
  });

  it('normalizes role lists: de-dupes, drops unknowns, defaults to employee', () => {
    expect(normalizeRoles(['developer', 'developer', 'bogus'])).toEqual(['developer']);
    expect(normalizeRoles([])).toEqual(['employee']);
    expect(normalizeRoles(['nope'])).toEqual(['employee']);
    expect(normalizeRoles(['manager', 'cto'])).toEqual(['manager', 'cto']);
  });
});
