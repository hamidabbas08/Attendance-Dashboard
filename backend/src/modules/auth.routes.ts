import { Router } from 'express';
import { z } from 'zod';
import { login } from '../auth/authService';
import { authenticate } from '../middleware/authenticate';
import { principalOf } from '../middleware/context';
import { rateLimit } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post(
  '/login',
  rateLimit({ windowMs: 60_000, max: 10, key: 'login' }),
  validateBody(loginSchema),
  async (req, res, next) => {
    try {
      const result = await login(req.body.email, req.body.password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Returns the caller's server-derived identity and permissions (drives the UI).
authRouter.get('/me', authenticate, (req, res) => {
  const p = principalOf(req);
  res.json({
    userId: p.userId,
    companyId: p.companyId,
    roles: p.roles,
    permissions: [...p.permissions],
    isPlatformAdmin: p.isPlatformAdmin,
    employeeId: p.employeeId,
  });
});
