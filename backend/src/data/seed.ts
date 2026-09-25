import { hashPassword } from '../auth/passwords';
import { ROLES } from '../rbac/roles';
import { InMemoryStore } from './store';

export interface SeededCompany {
  companyId: string;
  ownerId: string;
  hrId: string;
  employeeUserId: string;
  employeeId: string;
  shiftId: string;
  slackTeamId: string;
}

export interface SeedResult {
  password: string;
  platformAdminId: string;
  companyA: SeededCompany;
  companyB: SeededCompany;
}

const PASSWORD = 'Password123!';

async function seedCompany(
  store: InMemoryStore,
  opts: { name: string; slug: string; slackTeamId: string; empSlackUser: string },
): Promise<SeededCompany> {
  const now = store.now();
  const hash = await hashPassword(PASSWORD);

  const companyId = store.id();
  store.companies.set(companyId, {
    id: companyId,
    name: opts.name,
    slug: opts.slug,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  const shiftId = store.id();
  store.shifts.set(shiftId, {
    id: shiftId,
    companyId,
    name: 'Day Shift',
    startTime: '09:00',
    endTime: '18:00',
    graceMins: 15,
    createdAt: now,
    updatedAt: now,
  });

  const ruleId = store.id();
  store.attendanceRules.set(ruleId, {
    id: ruleId,
    companyId,
    workingDays: [1, 2, 3, 4, 5],
    defaultShiftId: shiftId,
    holidays: [],
    statuses: ['present', 'late', 'absent', 'leave', 'half_day', 'off_day', 'holiday'],
    createdAt: now,
    updatedAt: now,
  });

  const ownerId = store.id();
  store.users.set(ownerId, {
    id: ownerId,
    companyId,
    slackUserId: null,
    name: `${opts.name} Owner`,
    email: `owner@${opts.slug}.test`,
    passwordHash: hash,
    status: 'active',
    roles: [ROLES.COMPANY_OWNER],
    createdAt: now,
    updatedAt: now,
  });

  const hrId = store.id();
  store.users.set(hrId, {
    id: hrId,
    companyId,
    slackUserId: null,
    name: `${opts.name} HR`,
    email: `hr@${opts.slug}.test`,
    passwordHash: hash,
    status: 'active',
    roles: [ROLES.HR_MANAGER],
    createdAt: now,
    updatedAt: now,
  });

  const employeeUserId = store.id();
  store.users.set(employeeUserId, {
    id: employeeUserId,
    companyId,
    slackUserId: opts.empSlackUser,
    name: `${opts.name} Employee`,
    email: `employee@${opts.slug}.test`,
    passwordHash: hash,
    status: 'active',
    roles: [ROLES.EMPLOYEE],
    createdAt: now,
    updatedAt: now,
  });

  const employeeId = store.id();
  store.employees.set(employeeId, {
    id: employeeId,
    companyId,
    userId: employeeUserId,
    shiftId,
    slackUserId: opts.empSlackUser,
    name: `${opts.name} Employee`,
    email: `employee@${opts.slug}.test`,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // A couple of attendance records.
  for (const [date, status, checkIn] of [
    ['2026-09-21', 'present', '08:55'],
    ['2026-09-22', 'late', '09:40'],
  ] as const) {
    const id = store.id();
    store.attendanceRecords.set(id, {
      id,
      companyId,
      employeeId,
      date,
      checkIn,
      checkOut: '18:00',
      status,
      createdAt: now,
      updatedAt: now,
    });
  }

  const wsId = store.id();
  store.slackWorkspaces.set(wsId, {
    id: wsId,
    companyId,
    slackTeamId: opts.slackTeamId,
    workspaceName: `${opts.name} Workspace`,
    accessToken: `xoxb-${opts.slug}-secret-token`,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  return {
    companyId,
    ownerId,
    hrId,
    employeeUserId,
    employeeId,
    shiftId,
    slackTeamId: opts.slackTeamId,
  };
}

export async function seedDatabase(store: InMemoryStore): Promise<SeedResult> {
  store.reset();
  const now = store.now();

  const platformAdminId = store.id();
  store.users.set(platformAdminId, {
    id: platformAdminId,
    companyId: null,
    slackUserId: null,
    name: 'Platform Admin',
    email: 'admin@platform.test',
    passwordHash: await hashPassword(PASSWORD),
    status: 'active',
    roles: [ROLES.PLATFORM_ADMIN],
    createdAt: now,
    updatedAt: now,
  });

  const companyA = await seedCompany(store, {
    name: 'Acme Inc',
    slug: 'acme',
    slackTeamId: 'T_ACME',
    empSlackUser: 'U_ACME_EMP',
  });
  const companyB = await seedCompany(store, {
    name: 'Globex',
    slug: 'globex',
    slackTeamId: 'T_GLOBEX',
    empSlackUser: 'U_GLOBEX_EMP',
  });

  return { password: PASSWORD, platformAdminId, companyA, companyB };
}
