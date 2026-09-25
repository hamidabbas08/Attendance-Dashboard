import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../audit/auditService';
import { crossTenantRepo, principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { PERMISSIONS } from '../rbac/permissions';

export const companiesRouter = Router();

// Platform-admin only: list every tenant.
companiesRouter.get(
  '/',
  requirePermission(PERMISSIONS.PLATFORM_MANAGE),
  (req, res) => {
    res.json(crossTenantRepo(req).listCompanies());
  },
);

const createSchema = z.object({ name: z.string().min(1), slug: z.string().min(1) });

companiesRouter.post(
  '/',
  requirePermission(PERMISSIONS.PLATFORM_MANAGE),
  validateBody(createSchema),
  (req, res) => {
    const principal = principalOf(req);
    const company = crossTenantRepo(req).createCompany(req.body);
    recordAudit(req, principal, {
      action: 'company.create',
      resource: 'company',
      resourceId: company.id,
      companyId: company.id,
    });
    res.status(201).json(company);
  },
);

// A company member views their own company; a foreign id resolves to 404.
companiesRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.COMPANY_VIEW),
  (req, res) => {
    res.json(repoFor(req).getCompany(req.params.id));
  },
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.string().optional(),
});

companiesRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.COMPANY_UPDATE),
  validateBody(updateSchema),
  (req, res) => {
    const principal = principalOf(req);
    const company = repoFor(req).updateCompany(req.params.id, req.body);
    recordAudit(req, principal, {
      action: 'company.update',
      resource: 'company',
      resourceId: company.id,
      metadata: req.body,
    });
    res.json(company);
  },
);
