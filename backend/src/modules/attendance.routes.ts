import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../audit/auditService';
import { computeStatus } from '../attendance/attendanceEngine';
import { principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { ForbiddenError } from '../errors';
import { PERMISSIONS } from '../rbac/permissions';

export const attendanceRouter = Router();

// An employee's own attendance only. No company-wide data is reachable here.
attendanceRouter.get(
  '/me',
  requirePermission(PERMISSIONS.ATTENDANCE_VIEW_OWN),
  (req, res) => {
    const principal = principalOf(req);
    if (!principal.employeeId) {
      res.json([]);
      return;
    }
    res.json(repoFor(req).listAttendance({ employeeId: principal.employeeId }));
  },
);

// Company-wide attendance. Requires attendance:view_all (owner/HR/admin).
attendanceRouter.get('/', requirePermission(PERMISSIONS.ATTENDANCE_VIEW_ALL), (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const employeeId =
    typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
  res.json(repoFor(req).listAttendance({ from, to, employeeId }));
});

attendanceRouter.get('/:id', requirePermission(PERMISSIONS.ATTENDANCE_VIEW_ALL), (req, res) => {
  res.json(repoFor(req).getAttendance(req.params.id));
});

const upsertSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkIn: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  checkOut: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  status: z
    .enum(['present', 'late', 'absent', 'leave', 'half_day', 'off_day', 'holiday'])
    .optional(),
});

// Create/update an attendance record (manual correction). Recomputes status
// from the employee's shift + company rules unless an explicit status is given.
attendanceRouter.put(
  '/',
  requirePermission(PERMISSIONS.ATTENDANCE_UPDATE),
  validateBody(upsertSchema),
  (req, res) => {
    const principal = principalOf(req);
    const repo = repoFor(req);
    const employee = repo.getEmployee(req.body.employeeId); // 404 if foreign tenant
    const rule = repo.upsertAttendanceRule({});
    const shift = employee.shiftId ? repo.getShift(employee.shiftId) : null;
    const status =
      req.body.status ??
      computeStatus({
        date: req.body.date,
        checkIn: req.body.checkIn ?? null,
        checkOut: req.body.checkOut ?? null,
        shift,
        rule,
      });
    const record = repo.upsertAttendanceForDate({
      employeeId: employee.id,
      date: req.body.date,
      checkIn: req.body.checkIn ?? null,
      checkOut: req.body.checkOut ?? null,
      status,
    });
    recordAudit(req, principal, {
      action: 'attendance.update',
      resource: 'attendance_record',
      resourceId: record.id,
      metadata: { employeeId: employee.id, date: req.body.date, status },
    });
    res.json(record);
  },
);

// Defence in depth: employees can never reach the update route (no permission),
// but make the intent explicit for the self-service surface.
attendanceRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.ATTENDANCE_UPDATE),
  validateBody(upsertSchema.partial()),
  (req, res) => {
    const principal = principalOf(req);
    if (!principal.permissions.has(PERMISSIONS.ATTENDANCE_UPDATE)) {
      throw new ForbiddenError();
    }
    const record = repoFor(req).updateAttendance(req.params.id, req.body);
    recordAudit(req, principal, {
      action: 'attendance.update',
      resource: 'attendance_record',
      resourceId: record.id,
      metadata: req.body,
    });
    res.json(record);
  },
);
