import { ForbiddenError, NotFoundError } from '../errors';
import { InMemoryStore } from './store';
import { TenantContext } from './tenantContext';
import {
  AttendanceEvent,
  AttendanceRecord,
  AttendanceRule,
  AuditLog,
  Company,
  Employee,
  Shift,
  SlackChannel,
  SlackWorkspace,
  User,
} from './types';

/**
 * The ONLY data-access surface route handlers are permitted to use.
 *
 * Every company-owned read/write is filtered by the TenantContext's companyId.
 * A non-admin context can only ever have its own companyId, so cross-tenant
 * reads are physically impossible through this class. Cross-tenant reads require
 * `ctx.crossTenant`, which only a platform admin can obtain.
 */
export class TenantRepository {
  constructor(
    private readonly store: InMemoryStore,
    private readonly ctx: TenantContext,
  ) {}

  /** The company id every scoped query must use; throws if the context is unscoped. */
  private requireCompanyId(): string {
    if (this.ctx.crossTenant) {
      throw new ForbiddenError('This operation cannot run in cross-tenant mode');
    }
    if (!this.ctx.companyId) {
      throw new ForbiddenError('No tenant scope on this request');
    }
    return this.ctx.companyId;
  }

  /** Defence-in-depth: verify a loaded row belongs to the caller's tenant. */
  private assertOwned<T extends { companyId: string }>(row: T | undefined): T {
    if (!row) {
      throw new NotFoundError();
    }
    if (!this.ctx.crossTenant && row.companyId !== this.ctx.companyId) {
      // Never reveal that the row exists in another tenant.
      throw new NotFoundError();
    }
    return row;
  }

  // ---------------------------------------------------------------- Companies

  getCompany(id: string): Company {
    const company = this.store.companies.get(id);
    if (!company) throw new NotFoundError('Company not found');
    if (!this.ctx.crossTenant && id !== this.ctx.companyId) {
      throw new NotFoundError('Company not found');
    }
    return company;
  }

  listCompanies(): Company[] {
    if (!this.ctx.crossTenant) {
      throw new ForbiddenError('Listing all companies requires platform admin');
    }
    return [...this.store.companies.values()];
  }

  createCompany(data: Pick<Company, 'name' | 'slug'>): Company {
    if (!this.ctx.crossTenant) {
      throw new ForbiddenError('Creating companies requires platform admin');
    }
    const now = this.store.now();
    const company: Company = {
      id: this.store.id(),
      name: data.name,
      slug: data.slug,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.store.companies.set(company.id, company);
    return company;
  }

  updateCompany(id: string, patch: Partial<Pick<Company, 'name' | 'status'>>): Company {
    const company = this.getCompany(id);
    Object.assign(company, patch, { updatedAt: this.store.now() });
    return company;
  }

  // -------------------------------------------------------------------- Users

  getUserByIdRaw(id: string): User | undefined {
    return this.store.users.get(id);
  }

  listUsers(): User[] {
    const companyId = this.requireCompanyId();
    return [...this.store.users.values()].filter((u) => u.companyId === companyId);
  }

  getUser(id: string): User {
    const companyId = this.requireCompanyId();
    const user = this.store.users.get(id);
    if (!user || user.companyId !== companyId) throw new NotFoundError('User not found');
    return user;
  }

  createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    const now = this.store.now();
    const user: User = { ...data, id: this.store.id(), createdAt: now, updatedAt: now };
    this.store.users.set(user.id, user);
    return user;
  }

  updateUser(id: string, patch: Partial<Omit<User, 'id' | 'companyId'>>): User {
    const user = this.getUser(id);
    Object.assign(user, patch, { updatedAt: this.store.now() });
    return user;
  }

  deleteUser(id: string): void {
    const user = this.getUser(id);
    this.store.users.delete(user.id);
  }

  // ---------------------------------------------------------------- Employees

  listEmployees(): Employee[] {
    const companyId = this.requireCompanyId();
    return [...this.store.employees.values()].filter((e) => e.companyId === companyId);
  }

  getEmployee(id: string): Employee {
    return this.assertOwned(this.store.employees.get(id));
  }

  findEmployeeBySlackUser(companyId: string, slackUserId: string): Employee | undefined {
    return [...this.store.employees.values()].find(
      (e) => e.companyId === companyId && e.slackUserId === slackUserId,
    );
  }

  createEmployee(
    data: Omit<Employee, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>,
  ): Employee {
    const companyId = this.requireCompanyId();
    const now = this.store.now();
    const employee: Employee = {
      ...data,
      id: this.store.id(),
      companyId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.employees.set(employee.id, employee);
    return employee;
  }

  updateEmployee(
    id: string,
    patch: Partial<Omit<Employee, 'id' | 'companyId'>>,
  ): Employee {
    const employee = this.getEmployee(id);
    Object.assign(employee, patch, { updatedAt: this.store.now() });
    return employee;
  }

  deleteEmployee(id: string): void {
    const employee = this.getEmployee(id);
    this.store.employees.delete(employee.id);
  }

  // ------------------------------------------------------------------- Shifts

  listShifts(): Shift[] {
    const companyId = this.requireCompanyId();
    return [...this.store.shifts.values()].filter((s) => s.companyId === companyId);
  }

  getShift(id: string): Shift {
    return this.assertOwned(this.store.shifts.get(id));
  }

  createShift(data: Omit<Shift, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Shift {
    const companyId = this.requireCompanyId();
    const now = this.store.now();
    const shift: Shift = {
      ...data,
      id: this.store.id(),
      companyId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.shifts.set(shift.id, shift);
    return shift;
  }

  updateShift(id: string, patch: Partial<Omit<Shift, 'id' | 'companyId'>>): Shift {
    const shift = this.getShift(id);
    Object.assign(shift, patch, { updatedAt: this.store.now() });
    return shift;
  }

  // ---------------------------------------------------------- Attendance rules

  getAttendanceRule(): AttendanceRule | undefined {
    const companyId = this.requireCompanyId();
    return [...this.store.attendanceRules.values()].find((r) => r.companyId === companyId);
  }

  upsertAttendanceRule(
    data: Partial<Omit<AttendanceRule, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>>,
  ): AttendanceRule {
    const companyId = this.requireCompanyId();
    const now = this.store.now();
    let rule = [...this.store.attendanceRules.values()].find((r) => r.companyId === companyId);
    if (rule) {
      Object.assign(rule, data, { updatedAt: now });
      return rule;
    }
    rule = {
      id: this.store.id(),
      companyId,
      workingDays: data.workingDays ?? [1, 2, 3, 4, 5],
      defaultShiftId: data.defaultShiftId ?? null,
      holidays: data.holidays ?? [],
      statuses: data.statuses ?? [
        'present',
        'late',
        'absent',
        'leave',
        'half_day',
        'off_day',
        'holiday',
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.store.attendanceRules.set(rule.id, rule);
    return rule;
  }

  // -------------------------------------------------------- Attendance records

  listAttendance(filter?: {
    employeeId?: string;
    from?: string;
    to?: string;
  }): AttendanceRecord[] {
    const companyId = this.requireCompanyId();
    return [...this.store.attendanceRecords.values()].filter((r) => {
      if (r.companyId !== companyId) return false;
      if (filter?.employeeId && r.employeeId !== filter.employeeId) return false;
      if (filter?.from && r.date < filter.from) return false;
      if (filter?.to && r.date > filter.to) return false;
      return true;
    });
  }

  getAttendance(id: string): AttendanceRecord {
    return this.assertOwned(this.store.attendanceRecords.get(id));
  }

  upsertAttendanceForDate(
    data: Omit<AttendanceRecord, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>,
  ): AttendanceRecord {
    const companyId = this.requireCompanyId();
    const now = this.store.now();
    let record = [...this.store.attendanceRecords.values()].find(
      (r) =>
        r.companyId === companyId &&
        r.employeeId === data.employeeId &&
        r.date === data.date,
    );
    if (record) {
      Object.assign(record, data, { updatedAt: now });
      return record;
    }
    record = {
      ...data,
      id: this.store.id(),
      companyId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.attendanceRecords.set(record.id, record);
    return record;
  }

  updateAttendance(
    id: string,
    patch: Partial<Omit<AttendanceRecord, 'id' | 'companyId'>>,
  ): AttendanceRecord {
    const record = this.getAttendance(id);
    Object.assign(record, patch, { updatedAt: this.store.now() });
    return record;
  }

  // -------------------------------------------------------------------- Slack

  getSlackWorkspace(): SlackWorkspace | undefined {
    const companyId = this.requireCompanyId();
    return [...this.store.slackWorkspaces.values()].find((w) => w.companyId === companyId);
  }

  /** Tenant resolution key: team id → workspace → company. NOT tenant-scoped. */
  findSlackWorkspaceByTeamId(teamId: string): SlackWorkspace | undefined {
    return [...this.store.slackWorkspaces.values()].find((w) => w.slackTeamId === teamId);
  }

  upsertSlackWorkspace(
    data: Omit<SlackWorkspace, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>,
  ): SlackWorkspace {
    const companyId = this.requireCompanyId();
    const now = this.store.now();
    let workspace = [...this.store.slackWorkspaces.values()].find(
      (w) => w.companyId === companyId,
    );
    if (workspace) {
      Object.assign(workspace, data, { updatedAt: now });
      return workspace;
    }
    workspace = {
      ...data,
      id: this.store.id(),
      companyId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.slackWorkspaces.set(workspace.id, workspace);
    return workspace;
  }

  listSlackChannels(): SlackChannel[] {
    const companyId = this.requireCompanyId();
    return [...this.store.slackChannels.values()].filter((c) => c.companyId === companyId);
  }

  // ------------------------------------------------------- Attendance events

  createAttendanceEvent(
    companyId: string,
    data: Omit<AttendanceEvent, 'id' | 'companyId' | 'createdAt'>,
  ): AttendanceEvent {
    const now = this.store.now();
    const event: AttendanceEvent = {
      ...data,
      id: this.store.id(),
      companyId,
      createdAt: now,
    };
    this.store.attendanceEvents.set(event.id, event);
    return event;
  }

  // ---------------------------------------------------------------- Audit log

  /** Append-only. There is deliberately no update/delete method for audit logs. */
  appendAuditLog(data: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    const log: AuditLog = {
      ...data,
      id: this.store.id(),
      createdAt: this.store.now(),
    };
    this.store.auditLogs.set(log.id, log);
    return log;
  }

  listAuditLogs(): AuditLog[] {
    const companyId = this.requireCompanyId();
    return [...this.store.auditLogs.values()]
      .filter((l) => l.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
