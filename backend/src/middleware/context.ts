import { Request } from 'express';
import { Principal } from '../rbac/principal';
import { TenantRepository } from '../data/repository';
import { store } from '../data/store';
import { contextFor, crossTenantContext } from '../data/tenantContext';
import { UnauthorizedError } from '../errors';

/** Request-scoped state attached by the authenticate middleware. */
export interface RequestContext {
  principal: Principal;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: RequestContext;
    }
  }
}

export function principalOf(req: Request): Principal {
  if (!req.ctx) throw new UnauthorizedError();
  return req.ctx.principal;
}

/** A repository scoped to the caller's own tenant. */
export function repoFor(req: Request): TenantRepository {
  return new TenantRepository(store, contextFor(principalOf(req)));
}

/** A cross-tenant repository — only usable by a platform admin. */
export function crossTenantRepo(req: Request): TenantRepository {
  return new TenantRepository(store, crossTenantContext(principalOf(req)));
}
