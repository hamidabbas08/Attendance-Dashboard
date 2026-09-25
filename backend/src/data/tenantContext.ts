import { ForbiddenError } from '../errors';
import { Principal } from '../rbac/principal';

/**
 * The tenant scope every data-access call must carry.
 *
 * - A normal (non-admin) principal produces a context locked to its own
 *   companyId. It is impossible to construct a context for another company
 *   from such a principal.
 * - A platform admin can produce either a company-scoped context (to act
 *   within one tenant) or an explicit cross-tenant context.
 */
export interface TenantContext {
  companyId: string | null;
  crossTenant: boolean;
}

/** Build the default context for a principal: scoped to their own company. */
export function contextFor(principal: Principal): TenantContext {
  if (principal.isPlatformAdmin) {
    // Admin default is still single-tenant-safe unless they opt into cross-tenant.
    return { companyId: principal.companyId, crossTenant: false };
  }
  if (!principal.companyId) {
    throw new ForbiddenError('User is not associated with a company');
  }
  return { companyId: principal.companyId, crossTenant: false };
}

/**
 * Explicit cross-tenant escape hatch. Only a platform admin may obtain it, and
 * callers must have already passed a `platform:manage` permission check.
 */
export function crossTenantContext(principal: Principal): TenantContext {
  if (!principal.isPlatformAdmin) {
    throw new ForbiddenError('Cross-tenant access requires platform admin');
  }
  return { companyId: null, crossTenant: true };
}

/** Build an admin context scoped to a specific company they chose to inspect. */
export function adminCompanyContext(principal: Principal, companyId: string): TenantContext {
  if (!principal.isPlatformAdmin) {
    throw new ForbiddenError('Only platform admin may target an arbitrary company');
  }
  return { companyId, crossTenant: false };
}
