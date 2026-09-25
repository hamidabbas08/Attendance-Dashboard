import { Router } from 'express';
import { recordAudit } from '../audit/auditService';
import { principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { PERMISSIONS } from '../rbac/permissions';

export const reportsRouter = Router();

function buildSummary(req: Parameters<typeof repoFor>[0]) {
  const repo = repoFor(req);
  const records = repo.listAttendance();
  const counts: Record<string, number> = {};
  for (const r of records) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return { total: records.length, byStatus: counts, records };
}

reportsRouter.get(
  '/attendance',
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  (req, res) => {
    const { total, byStatus } = buildSummary(req);
    res.json({ total, byStatus });
  },
);

reportsRouter.get(
  '/attendance.csv',
  requirePermission(PERMISSIONS.REPORTS_EXPORT),
  (req, res) => {
    const principal = principalOf(req);
    const { records } = buildSummary(req);
    const header = 'date,employee_id,check_in,check_out,status';
    const rows = records.map(
      (r) =>
        `${r.date},${r.employeeId},${r.checkIn ?? ''},${r.checkOut ?? ''},${r.status}`,
    );
    recordAudit(req, principal, {
      action: 'reports.export',
      resource: 'attendance_report',
      metadata: { rowCount: records.length },
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
    res.send([header, ...rows].join('\n'));
  },
);
