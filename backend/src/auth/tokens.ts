import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { UnauthorizedError } from '../errors';

export interface TokenPayload {
  /** The user id. This is the ONLY identity claim the server trusts. */
  sub: string;
}

export function issueToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === 'string' || !decoded.sub) {
      throw new UnauthorizedError('Invalid token');
    }
    return { sub: String(decoded.sub) };
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
