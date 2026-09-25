import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../audit/auditService';
import { principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { PERMISSIONS } from '../rbac/permissions';
import { answerQuery, buildQueryContext } from '../claude/claudeQueryService';

export const claudeRouter = Router();

const querySchema = z.object({ question: z.string().min(1).max(500) });

/**
 * Natural-language attendance query. The permission floor is claude:query_own;
 * a company-wide question is upgraded to require claude:query_all inside
 * buildQueryContext and rejected with 403 otherwise. Claude only ever receives
 * the permission-filtered, tenant-scoped dataset.
 */
claudeRouter.post(
  '/query',
  rateLimit({ windowMs: 60_000, max: 30, key: 'claude_query' }),
  requirePermission(PERMISSIONS.CLAUDE_QUERY_OWN),
  validateBody(querySchema),
  async (req, res, next) => {
    try {
      const principal = principalOf(req);
      const context = buildQueryContext(principal, repoFor(req), req.body.question);
      const result = await answerQuery(context);
      recordAudit(req, principal, {
        action: 'claude.query',
        resource: 'attendance',
        metadata: { scope: result.scope, question: req.body.question },
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
