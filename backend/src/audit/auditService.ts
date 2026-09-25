import { Request } from 'express';
import { store } from '../data/store';
import { Principal } from '../rbac/principal';

/**
 * Append an immutable audit-log entry for a sensitive operation. Audit logs are
 * append-only: there is no update or delete path anywhere in the application.
 */
export function recordAudit(
  req: Request,
  principal: Principal,
  entry: {
    action: string;
    resource: string;
    resourceId?: string | null;
    companyId?: string | null;
    metadata?: Record<string, unknown>;
  },
): void {
  const id = store.id();
  store.auditLogs.set(id, {
    id,
    companyId: entry.companyId ?? principal.companyId,
    userId: principal.userId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId ?? null,
    metadata: entry.metadata ?? {},
    ipAddress: req.ip ?? null,
    createdAt: store.now(),
  });
}
