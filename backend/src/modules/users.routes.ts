import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../audit/auditService';
import { hashPassword } from '../auth/passwords';
import { principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { ForbiddenError, ValidationError } from '../errors';
import { PERMISSIONS } from '../rbac/permissions';
import { ROLES } from '../rbac/roles';
import { serializeUser } from './serializers';

export const usersRouter = Router();

usersRouter.get('/', requirePermission(PERMISSIONS.USERS_VIEW), (req, res) => {
  res.json(repoFor(req).listUsers().map(serializeUser));
});

usersRouter.get('/:id', requirePermission(PERMISSIONS.USERS_VIEW), (req, res) => {
  res.json(serializeUser(repoFor(req).getUser(req.params.id)));
});

// Company owners may create HR/employee users; they may NOT mint platform admins.
const assignableRoles = [ROLES.HR_MANAGER, ROLES.EMPLOYEE, ROLES.COMPANY_OWNER] as const;

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(z.enum(assignableRoles)).min(1),
  slackUserId: z.string().nullable().optional(),
});

usersRouter.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE),
  validateBody(createSchema),
  async (req, res, next) => {
    try {
      const principal = principalOf(req);
      if (!principal.companyId) {
        // Platform admin creating tenant users must go through admin flows.
        throw new ForbiddenError('Company context required to create users');
      }
      const repo = repoFor(req);
      const passwordHash = await hashPassword(req.body.password);
      const user = repo.createUser({
        companyId: principal.companyId,
        slackUserId: req.body.slackUserId ?? null,
        name: req.body.name,
        email: req.body.email,
        passwordHash,
        status: 'active',
        roles: req.body.roles,
      });
      recordAudit(req, principal, {
        action: 'user.create',
        resource: 'user',
        resourceId: user.id,
        metadata: { roles: req.body.roles },
      });
      res.status(201).json(serializeUser(user));
    } catch (err) {
      next(err);
    }
  },
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  roles: z.array(z.enum(assignableRoles)).min(1).optional(),
});

usersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validateBody(updateSchema),
  (req, res) => {
    const principal = principalOf(req);
    // Privilege-escalation guard: nobody can grant platform_admin through this API.
    if (req.body.roles?.some((r: string) => !assignableRoles.includes(r as never))) {
      throw new ValidationError('Cannot assign that role');
    }
    const user = repoFor(req).updateUser(req.params.id, req.body);
    recordAudit(req, principal, {
      action: 'user.update',
      resource: 'user',
      resourceId: user.id,
      metadata: req.body,
    });
    res.json(serializeUser(user));
  },
);

usersRouter.delete('/:id', requirePermission(PERMISSIONS.USERS_DELETE), (req, res) => {
  const principal = principalOf(req);
  if (req.params.id === principal.userId) {
    throw new ForbiddenError('You cannot delete your own account');
  }
  repoFor(req).deleteUser(req.params.id);
  recordAudit(req, principal, {
    action: 'user.delete',
    resource: 'user',
    resourceId: req.params.id,
  });
  res.status(204).send();
});
