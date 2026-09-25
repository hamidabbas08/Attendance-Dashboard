import { Role } from '../rbac/roles';

/** Domain entity types — mirror the Prisma schema 1:1. */

export type UserStatus = 'active' | 'disabled';
export type EmployeeStatus = 'active' | 'inactive';
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
  status: EmployeeStatus;
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
