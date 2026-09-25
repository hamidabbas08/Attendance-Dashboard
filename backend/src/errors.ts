/** Typed application errors that map cleanly to HTTP status codes. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message, 'unauthorized');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, message, 'forbidden');
  }
}

/**
 * Used for both genuinely-missing resources AND cross-tenant access attempts,
 * so a caller can never distinguish "does not exist" from "belongs to another
 * tenant" (this is what closes the IDOR information leak).
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message, 'not_found');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request', details?: unknown) {
    super(422, message, 'validation_error', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, message, 'conflict');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, message, 'rate_limited');
  }
}
