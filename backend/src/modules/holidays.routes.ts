import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../audit/auditService';
import { principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { PERMISSIONS } from '../rbac/permissions';

export const holidaysRouter = Router();

// Anyone with company access can read holidays (they show on the attendance grid).
holidaysRouter.get('/', requirePermission(PERMISSIONS.ATTENDANCE_VIEW_OWN), (req, res) => {
  res.json(repoFor(req).listHolidays());
});

const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(100),
});

// Declare a company holiday (whole day off for everyone) with a name.
holidaysRouter.post(
  '/',
  requirePermission(PERMISSIONS.ATTENDANCE_RULES_CREATE),
  validateBody(upsertSchema),
  (req, res) => {
    const principal = principalOf(req);
    const holiday = repoFor(req).upsertHoliday(req.body.date, req.body.name.trim());
    recordAudit(req, principal, {
      action: 'holiday.upsert',
      resource: 'holiday',
      resourceId: holiday.id,
      metadata: { date: holiday.date, name: holiday.name },
    });
    res.json(holiday);
  },
);

holidaysRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.ATTENDANCE_RULES_UPDATE),
  (req, res) => {
    const principal = principalOf(req);
    repoFor(req).deleteHoliday(req.params.id);
    recordAudit(req, principal, {
      action: 'holiday.delete',
      resource: 'holiday',
      resourceId: req.params.id,
    });
    res.status(204).send();
  },
);
