import { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../errors';
import { can } from '../rbac/can';
import { Permission } from '../rbac/permissions';
import { principalOf } from './context';

/**
 * 403 gate. Asserts the caller holds the given permission. This is the ONLY
 * place route handlers express "who may do this" — never role-string checks.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const principal = principalOf(req);
      if (!can(principal, permission)) {
        throw new ForbiddenError(`Missing permission: ${permission}`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Require the caller to hold at least one of the given permissions. */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const principal = principalOf(req);
      if (!permissions.some((p) => can(principal, p))) {
        throw new ForbiddenError(`Missing one of: ${permissions.join(', ')}`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
