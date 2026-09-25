import { Permission } from './permissions';
import { Principal } from './principal';

/**
 * A resource that can be checked for tenant ownership. Any object with a
 * companyId participates in tenant-scoped authorization.
 */
export interface TenantResource {
  companyId?: string | null;
}

/**
 * Centralized authorization decision: `can(user, permission, resource?)`.
 *
 * Two independent gates, both of which must pass:
 *   1. Permission gate  — does the caller's role grant this permission at all?
 *   2. Tenant gate      — if a resource is supplied, does it belong to the
 *                         caller's company? (platform admin bypasses this.)
 *
 * This function is pure and exhaustively unit-tested; it is the single decision
 * point reused by every guard and service in the app.
 */
export function can(
  principal: Principal,
  permission: Permission,
  resource?: TenantResource,
): boolean {
  if (!principal.permissions.has(permission)) {
    return false;
  }

  if (resource === undefined) {
    return true;
  }

  return sameTenant(principal, resource);
}

/**
 * True when the resource belongs to the caller's tenant. Platform admins are
 * cross-tenant and always pass. A non-admin with no companyId never passes.
 */
export function sameTenant(principal: Principal, resource: TenantResource): boolean {
  if (principal.isPlatformAdmin) {
    return true;
  }
  if (!principal.companyId) {
    return false;
  }
  if (resource.companyId == null) {
    // A company-owned resource with no companyId is malformed — deny.
    return false;
  }
  return resource.companyId === principal.companyId;
}
