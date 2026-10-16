import { Router } from 'express';
import { principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { PERMISSIONS } from '../rbac/permissions';

export const breaksRouter = Router();

/**
 * The caller's own breaks (opened when their scrin.io activity is paused).
 * Optional ?date=YYYY-MM-DD narrows to one day.
 */
breaksRouter.get('/me', requirePermission(PERMISSIONS.ATTENDANCE_VIEW_OWN), (req, res) => {
  const principal = principalOf(req);
  if (!principal.employeeId) {
    res.json([]);
    return;
  }
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  res.json(repoFor(req).listBreaks({ employeeId: principal.employeeId, date }));
});

/**
 * Company-wide breaks (managers/owners). Optional ?employeeId= and ?date=.
 */
breaksRouter.get('/', requirePermission(PERMISSIONS.ATTENDANCE_VIEW_ALL), (req, res) => {
  const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  res.json(repoFor(req).listCompanyBreaks({ employeeId, date }));
});
