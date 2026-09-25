import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../audit/auditService';
import { principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { PERMISSIONS } from '../rbac/permissions';

export const attendanceRulesRouter = Router();

attendanceRulesRouter.get(
  '/',
  requirePermission(PERMISSIONS.ATTENDANCE_RULES_VIEW),
  (req, res) => {
    res.json(repoFor(req).getAttendanceRule() ?? null);
  },
);

const upsertSchema = z.object({
  workingDays: z.array(z.number().int().min(1).max(7)).optional(),
  defaultShiftId: z.string().nullable().optional(),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  statuses: z
    .array(
      z.enum(['present', 'late', 'absent', 'leave', 'half_day', 'off_day', 'holiday']),
    )
    .optional(),
});

// Single upsert endpoint gated by create+update (both held by owner/HR/admin).
attendanceRulesRouter.put(
  '/',
  requirePermission(PERMISSIONS.ATTENDANCE_RULES_UPDATE),
  validateBody(upsertSchema),
  (req, res) => {
    const principal = principalOf(req);
    const repo = repoFor(req);
    if (req.body.defaultShiftId) repo.getShift(req.body.defaultShiftId);
    const rule = repo.upsertAttendanceRule(req.body);
    recordAudit(req, principal, {
      action: 'attendance_rule.update',
      resource: 'attendance_rule',
      resourceId: rule.id,
      metadata: req.body,
    });
    res.json(rule);
  },
);
