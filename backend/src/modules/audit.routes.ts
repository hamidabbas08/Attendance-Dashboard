import { Router } from 'express';
import { repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { PERMISSIONS } from '../rbac/permissions';

export const auditRouter = Router();

// Read-only. Audit logs are append-only across the whole application — there is
// intentionally no route to update or delete them.
auditRouter.get('/', requirePermission(PERMISSIONS.AUDIT_VIEW), (req, res) => {
  res.json(repoFor(req).listAuditLogs());
});
