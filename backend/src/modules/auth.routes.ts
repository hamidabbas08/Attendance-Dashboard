import { Router } from 'express';
import { z } from 'zod';
import { login } from '../auth/authService';
import {
  buildAuthorizeUrl,
  consumeState,
  createState,
  exchangeCodeForIdentity,
  isSlackLoginConfigured,
  resolveSlackLogin,
} from '../auth/slackOAuth';
import { config } from '../config/env';
import { AppError } from '../errors';
import { authenticate } from '../middleware/authenticate';
import { principalOf } from '../middleware/context';
import { rateLimit } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

function redirectToFrontend(res: import('express').Response, params: Record<string, string>) {
  const url = new URL(config.frontendUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  res.redirect(url.toString());
}

// --- Sign in with Slack (OpenID Connect) ---------------------------------------

// Kicks off the OAuth flow: redirect the browser to Slack's consent screen.
authRouter.get('/slack/start', rateLimit({ windowMs: 60_000, max: 20, key: 'slack_start' }), (_req, res) => {
  if (!isSlackLoginConfigured()) {
    redirectToFrontend(res, { auth_error: 'slack_not_configured' });
    return;
  }
  res.redirect(buildAuthorizeUrl(createState()));
});

// Slack redirects back here with ?code&state. We resolve the tenant + user and
// hand a freshly-issued JWT to the frontend via the redirect URL.
authRouter.get('/slack/callback', async (req, res) => {
  try {
    if (req.query.error) {
      redirectToFrontend(res, { auth_error: String(req.query.error) });
      return;
    }
    if (!consumeState(req.query.state ? String(req.query.state) : undefined)) {
      redirectToFrontend(res, { auth_error: 'invalid_state' });
      return;
    }
    const code = req.query.code ? String(req.query.code) : '';
    if (!code) {
      redirectToFrontend(res, { auth_error: 'missing_code' });
      return;
    }
    const identity = await exchangeCodeForIdentity(code);
    const { token } = resolveSlackLogin(identity);
    redirectToFrontend(res, { token });
  } catch (err) {
    // Surface a specific reason so the login screen can explain what happened.
    const code = err instanceof AppError ? err.code : 'login_failed';
    redirectToFrontend(res, { auth_error: code });
  }
});

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
