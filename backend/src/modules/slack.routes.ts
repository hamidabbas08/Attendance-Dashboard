import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../audit/auditService';
import { principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { UnauthorizedError } from '../errors';
import { botTokenForWorkspace } from '../auth/slackOAuth';
import { AppError } from '../errors';
import { PERMISSIONS } from '../rbac/permissions';
import { processSlackEvent } from '../slack/eventHandler';
import { fetchSlackMembers } from '../slack/members';
import { verifySlackSignature } from '../slack/verify';
import { serializeSlackWorkspace } from './serializers';

// ---------------------------------------------------------------------------
// Authenticated management routes (mounted under /api/slack with authenticate).
// ---------------------------------------------------------------------------
export const slackRouter = Router();

slackRouter.get('/status', requirePermission(PERMISSIONS.SLACK_VIEW), (req, res) => {
  const ws = repoFor(req).getSlackWorkspace();
  res.json({
    connected: Boolean(ws),
    workspace: ws ? serializeSlackWorkspace(ws) : null,
    channels: ws ? repoFor(req).listSlackChannels() : [],
  });
});

const configureSchema = z.object({
  slackTeamId: z.string().min(1),
  workspaceName: z.string().min(1),
  // Optional: when blank, keep the token that is already stored.
  accessToken: z.string().optional().default(''),
});

slackRouter.post(
  '/configure',
  requirePermission(PERMISSIONS.SLACK_CONFIGURE),
  validateBody(configureSchema),
  (req, res) => {
    const principal = principalOf(req);
    const repo = repoFor(req);
    const existing = repo.getSlackWorkspace();
    const accessToken = req.body.accessToken?.trim() || existing?.accessToken || '';
    const ws = repo.upsertSlackWorkspace({
      slackTeamId: req.body.slackTeamId,
      workspaceName: req.body.workspaceName,
      accessToken,
      status: 'active',
    });
    recordAudit(req, principal, {
      action: 'slack.configure',
      resource: 'slack_workspace',
      resourceId: ws.id,
      // Never log the token itself.
      metadata: { slackTeamId: req.body.slackTeamId },
    });
    res.json(serializeSlackWorkspace(ws));
  },
);

// Import the workspace's members from Slack as employees (upsert by slack id).
slackRouter.post(
  '/sync-members',
  requirePermission(PERMISSIONS.EMPLOYEES_CREATE),
  async (req, res, next) => {
    try {
      const principal = principalOf(req);
      const repo = repoFor(req);
      const ws = repo.getSlackWorkspace();
      const token = ws ? botTokenForWorkspace(ws) : '';
      if (!ws || !token) {
        throw new AppError(
          400,
          'No Slack bot token configured. Set SLACK_BOT_TOKEN in the server environment.',
          'slack_token_missing',
        );
      }
      const members = await fetchSlackMembers(token);
      let imported = 0;
      let updated = 0;
      for (const m of members) {
        const existing = repo.findEmployeeBySlackUser(principal.companyId!, m.slackUserId);
        if (existing) {
          repo.updateEmployee(existing.id, { name: m.name, email: m.email || existing.email });
          updated += 1;
        } else {
          repo.createEmployee({
            userId: null,
            shiftId: null,
            slackUserId: m.slackUserId,
            name: m.name,
            email: m.email,
            status: 'active',
          });
          imported += 1;
        }
      }
      recordAudit(req, principal, {
        action: 'slack.sync_members',
        resource: 'employee',
        metadata: { imported, updated, total: members.length },
      });
      res.json({ imported, updated, total: members.length });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Public webhook route (mounted separately, NO user auth — Slack-signed).
// Tenant is resolved from the signed team_id, never from any client claim.
// ---------------------------------------------------------------------------
export const slackWebhookRouter = Router();

slackWebhookRouter.post(
  '/events',
  rateLimit({ windowMs: 60_000, max: 120, key: 'slack_events' }),
  (req, res, next) => {
    try {
      const rawBody: string = (req as unknown as { rawBody?: string }).rawBody ?? '';
      const valid = verifySlackSignature({
        signature: req.header('x-slack-signature'),
        timestamp: req.header('x-slack-request-timestamp'),
        rawBody,
      });
      if (!valid) {
        throw new UnauthorizedError('Invalid Slack signature');
      }

      // URL verification handshake.
      if (req.body?.type === 'url_verification') {
        res.json({ challenge: req.body.challenge });
        return;
      }

      const result = processSlackEvent(req.body);
      res.json({ ok: true, result });
    } catch (err) {
      next(err);
    }
  },
);
