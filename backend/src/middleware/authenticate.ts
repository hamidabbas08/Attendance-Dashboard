import { NextFunction, Request, Response } from 'express';
import { resolvePrincipal } from '../auth/authService';
import { verifyToken } from '../auth/tokens';
import { UnauthorizedError } from '../errors';

/**
 * 401 gate. Verifies the bearer token, then re-derives the caller's identity,
 * company, roles and permissions from the database. Nothing beyond the user id
 * is trusted from the token.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }
    const payload = verifyToken(header.slice('Bearer '.length).trim());
    const principal = resolvePrincipal(payload.sub);
    req.ctx = { principal };
    next();
  } catch (err) {
    next(err);
  }
}
