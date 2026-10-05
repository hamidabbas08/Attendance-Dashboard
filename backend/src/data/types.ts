import { Role } from '../rbac/roles';

/** Domain entity types — mirror the Prisma schema 1:1. */

export type UserStatus = 'active' | 'disabled';
export type EmployeeStatus = 'active' | 'inactive' | 'terminated';
export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'leave'
  | 'half_day'
  | 'off_day'
  | 'holiday';

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  companyId: string | null;
  slackUserId: string | null;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  companyId: string;
  userId: string | null;
  shiftId: string | null;
  slackUserId: string | null;
  name: string;
  email: string;
  avatarUrl: string | null; // Slack profile image, when available
  roles: Role[]; // team roles/titles; a person may hold several at once
  role: Role; // primary (strongest) role, derived from `roles` for convenience
  status: EmployeeStatus;
  terminatedAt: string | null; // YYYY-MM-DD; set when status === 'terminated'
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  companyId: string;
  name: string;
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  graceMins: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRule {
  id: string;
  companyId: string;
  workingDays: number[]; // ISO weekday numbers 1..7 (Mon..Sun)
  defaultShiftId: string | null;
  holidays: string[]; // "YYYY-MM-DD"
  statuses: AttendanceStatus[];
  createdAt: string;
  updatedAt: string;
}

/** A company-wide holiday: a whole day marked off for everyone, with a name. */
export interface Holiday {
  id: string;
  companyId: string;
  date: string; // "YYYY-MM-DD"
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  companyId: string;
  employeeId: string;
  date: string; // "YYYY-MM-DD"
  checkIn: string | null; // "HH:MM"
  checkOut: string | null;
  status: AttendanceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SlackWorkspace {
  id: string;
  companyId: string;
  slackTeamId: string;
  workspaceName: string;
  accessToken: string; // server-side only
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlackChannel {
  id: string;
  companyId: string;
  workspaceId: string;
  slackChannelId: string;
  name: string;
  purpose: string;
  createdAt: string;
}

export interface AttendanceEvent {
  id: string;
  companyId: string;
  employeeId: string | null;
  slackUserId: string;
  type: 'check_in' | 'check_out';
  rawText: string;
  occurredAt: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  companyId: string | null;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}
