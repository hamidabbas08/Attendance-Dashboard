import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../audit/auditService';
import { principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { PERMISSIONS } from '../rbac/permissions';

export const shiftsRouter = Router();

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM');

shiftsRouter.get('/', requirePermission(PERMISSIONS.SHIFTS_VIEW), (req, res) => {
  res.json(repoFor(req).listShifts());
});

const createSchema = z.object({
  name: z.string().min(1),
  startTime: hhmm,
  endTime: hhmm,
  graceMins: z.number().int().min(0).max(240).default(15),
});

shiftsRouter.post(
  '/',
  requirePermission(PERMISSIONS.SHIFTS_CREATE),
  validateBody(createSchema),
  (req, res) => {
    const principal = principalOf(req);
    const shift = repoFor(req).createShift(req.body);
    recordAudit(req, principal, {
      action: 'shift.create',
      resource: 'shift',
      resourceId: shift.id,
    });
    res.status(201).json(shift);
  },
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
  graceMins: z.number().int().min(0).max(240).optional(),
});

shiftsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.SHIFTS_UPDATE),
  validateBody(updateSchema),
  (req, res) => {
    const principal = principalOf(req);
    const shift = repoFor(req).updateShift(req.params.id, req.body);
    recordAudit(req, principal, {
      action: 'shift.update',
      resource: 'shift',
      resourceId: shift.id,
      metadata: req.body,
    });
    res.json(shift);
  },
);
