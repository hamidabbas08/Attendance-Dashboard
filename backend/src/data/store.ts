import { randomUUID } from 'crypto';
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
 * Low-level in-memory data store. This is an intentionally simple adapter that
 * lets the full application (and its security tests) run with no external
 * database. The production adapter (Prisma/PostgreSQL) exposes the same shape.
 *
 * This class is NOT tenant-aware on its own — all tenant scoping is enforced by
 * TenantRepository, which is the only thing route handlers are allowed to touch.
 */
export class InMemoryStore {
  companies = new Map<string, Company>();
  users = new Map<string, User>();
  employees = new Map<string, Employee>();
  shifts = new Map<string, Shift>();
  attendanceRules = new Map<string, AttendanceRule>();
  attendanceRecords = new Map<string, AttendanceRecord>();
  slackWorkspaces = new Map<string, SlackWorkspace>();
  slackChannels = new Map<string, SlackChannel>();
  attendanceEvents = new Map<string, AttendanceEvent>();
  auditLogs = new Map<string, AuditLog>();

  id(): string {
    return randomUUID();
  }

  now(): string {
    return new Date().toISOString();
  }

  reset(): void {
    this.companies.clear();
    this.users.clear();
    this.employees.clear();
    this.shifts.clear();
    this.attendanceRules.clear();
    this.attendanceRecords.clear();
    this.slackWorkspaces.clear();
    this.slackChannels.clear();
    this.attendanceEvents.clear();
    this.auditLogs.clear();
  }
}

/** Process-wide singleton store used by the running server. */
export const store = new InMemoryStore();
