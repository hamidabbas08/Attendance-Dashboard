import { Request, Response, Router } from 'express';
import { getDayActivity, getOverview, scrinEnabled } from '../scrin/service';
import { principalOf, repoFor } from '../middleware/context';
import { requireAnyPermission } from '../middleware/authorize';
import { can } from '../rbac/can';
import { PERMISSIONS } from '../rbac/permissions';

export const scrinRouter = Router();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// `employeeId` may be any employee when the caller holds attendance:view_all
// (the admin/HR employee page), or only the caller's own when they hold just
// attendance:view_own (the self-service My Attendance page) — the same
// self-vs-all split as /api/attendance/me vs /api/attendance.
function requireEmployeeId(req: Request, res: Response): string | null {
  const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
  if (!employeeId) {
    res.status(400).json({ error: { code: 'bad_request', message: 'employeeId is required' } });
    return null;
  }
  const principal = principalOf(req);
  const isSelf = principal.employeeId === employeeId;
  if (!isSelf && !can(principal, PERMISSIONS.ATTENDANCE_VIEW_ALL)) {
    res.status(403).json({ error: { code: 'forbidden', message: `Missing permission: ${PERMISSIONS.ATTENDANCE_VIEW_ALL}` } });
    return null;
  }
  return employeeId;
}

// Today / yesterday / this-week / this-month totals + which days in `month`
// have activity — backs the summary tiles and day-picker strip, mirroring
// scrin.io's own "My Home" / employee dashboard.
scrinRouter.get(
  '/overview',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_OWN),
  async (req, res) => {
    const employeeId = requireEmployeeId(req, res);
    if (!employeeId) return;
    const month =
      typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : undefined;

    if (!scrinEnabled) {
      res.json({
        configured: false, linked: false, lastActive: null,
        todaySeconds: 0, yesterdaySeconds: 0, weekSeconds: 0, monthSeconds: 0, activeDays: [],
      });
      return;
    }

    const employee = repoFor(req).getEmployee(employeeId); // 404s if foreign tenant
    const result = await getOverview(employee.email, month);
    res.json({ configured: true, ...result });
  },
);

// One day's tracked activity, grouped into task blocks with their screenshots.
scrinRouter.get(
  '/activity',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_OWN),
  async (req, res) => {
    const employeeId = requireEmployeeId(req, res);
    if (!employeeId) return;
    const date =
      typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : today();

    if (!scrinEnabled) {
      res.json({ configured: false, linked: false, totalSeconds: 0, blocks: [] });
      return;
    }

    const employee = repoFor(req).getEmployee(employeeId); // 404s if foreign tenant
    const result = await getDayActivity(employee.email, date);
    res.json({ configured: true, ...result });
  },
);
