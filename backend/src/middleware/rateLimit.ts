import { NextFunction, Request, Response } from 'express';
import { RateLimitError } from '../errors';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal in-memory fixed-window rate limiter. Keyed by client IP + route key.
 * For a multi-instance production deploy this would be backed by Redis; the
 * interface is intentionally the same.
 */
export function rateLimit(options: { windowMs: number; max: number; key: string }) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const now = Date.now();
    const id = `${options.key}:${req.ip}`;
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(id, bucket);
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      next(new RateLimitError('Rate limit exceeded, please retry later'));
      return;
    }
    next();
  };
}
