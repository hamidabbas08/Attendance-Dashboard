import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../audit/auditService';
import { ForbiddenError } from '../errors';
import { principalOf, repoFor } from '../middleware/context';
import { requirePermission } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { PERMISSIONS } from '../rbac/permissions';

export const employeesRouter = Router();

employeesRouter.get('/', requirePermission(PERMISSIONS.EMPLOYEES_VIEW), (req, res) => {
  res.json(repoFor(req).listEmployees());
});

// The logged-in user's own employee record + assigned shift. Any authenticated
// user can read their own (so employees can see their shift and overtime).
employeesRouter.get('/me', requirePermission(PERMISSIONS.ATTENDANCE_VIEW_OWN), (req, res) => {
  const principal = principalOf(req);
  if (!principal.employeeId) {
    res.json({ employee: null, shift: null });
    return;
  }
  const repo = repoFor(req);
  const employee = repo.getEmployee(principal.employeeId);
  const shift = employee.shiftId ? repo.getShift(employee.shiftId) : null;
  res.json({ employee, shift });
});

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM');
const shiftSchema = z.object({
  startTime: hhmm,
  endTime: hhmm,
  graceMins: z.number().int().min(0).max(240).default(15),
});

// Upsert the shift for a single employee (create one if they have none, else
// update it). Powers the inline per-employee shift editor.
employeesRouter.put(
  '/:id/shift',
  requirePermission(PERMISSIONS.SHIFTS_UPDATE),
  validateBody(shiftSchema),
  (req, res) => {
    const principal = principalOf(req);
    const repo = repoFor(req);
    const employee = repo.getEmployee(req.params.id);
    // Whether any OTHER employee is on this same shift — the company Day/Night
    // shifts are shared, so editing one person's times must not change everyone
    // else's. In that case give this employee their own copy and reassign them.
    const sharedWithOthers = (shiftId: string) =>
      repo.listEmployees().some((e) => e.id !== employee.id && e.shiftId === shiftId);
    let shift;
    if (employee.shiftId && !sharedWithOthers(employee.shiftId)) {
      shift = repo.updateShift(employee.shiftId, req.body);
    } else {
      shift = repo.createShift({ name: `${employee.name} shift`, ...req.body });
      repo.updateEmployee(employee.id, { shiftId: shift.id });
    }
    recordAudit(req, principal, {
      action: 'employee.shift.update',
      resource: 'shift',
      resourceId: shift.id,
      metadata: { employeeId: employee.id, ...req.body },
    });
    res.json({ employeeId: employee.id, shift });
  },
);

employeesRouter.get('/:id', requirePermission(PERMISSIONS.EMPLOYEES_VIEW), (req, res) => {
  res.json(repoFor(req).getEmployee(req.params.id));
});

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  shiftId: z.string().nullable().optional(),
  slackUserId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
});

employeesRouter.post(
  '/',
  requirePermission(PERMISSIONS.EMPLOYEES_CREATE),
  validateBody(createSchema),
  (req, res) => {
    const principal = principalOf(req);
    const repo = repoFor(req);
    // Validate any referenced shift belongs to the same tenant (getShift enforces it).
    if (req.body.shiftId) repo.getShift(req.body.shiftId);
    const employee = repo.createEmployee({
      userId: req.body.userId ?? null,
      shiftId: req.body.shiftId ?? null,
      slackUserId: req.body.slackUserId ?? null,
      name: req.body.name,
      email: req.body.email,
      status: 'active',
    });
    recordAudit(req, principal, {
      action: 'employee.create',
      resource: 'employee',
      resourceId: employee.id,
    });
    res.status(201).json(employee);
  },
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  shiftId: z.string().nullable().optional(),
  slackUserId: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
  terminatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  // A person may hold several roles/titles at once. Unknown values are dropped
  // and an empty list defaults to ['employee'] (see normalizeRoles).
  roles: z.array(z.string()).optional(),
  // Back-compat: a single role is still accepted.
  role: z.string().optional(),
});

employeesRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.EMPLOYEES_UPDATE),
  validateBody(updateSchema),
  (req, res) => {
    const principal = principalOf(req);
    const repo = repoFor(req);
    if (req.body.shiftId) repo.getShift(req.body.shiftId);
    // Changing a team member's ROLE(s) requires user-management permission.
    if ((req.body.role || req.body.roles) && !principal.permissions.has(PERMISSIONS.USERS_UPDATE)) {
      throw new ForbiddenError('You do not have permission to change roles');
    }
    // Termination carries a date: default to today when marking terminated,
    // and clear it when the person is reactivated.
    const patch = { ...req.body };
    if (patch.status === 'terminated' && !patch.terminatedAt) {
      patch.terminatedAt = new Date().toISOString().slice(0, 10);
    } else if (patch.status === 'active' || patch.status === 'inactive') {
      patch.terminatedAt = null;
    }
    const before = repo.getEmployee(req.params.id);
    const employee = repo.updateEmployee(req.params.id, patch);
    recordAudit(req, principal, {
      action: 'employee.update',
      resource: 'employee',
      resourceId: employee.id,
      metadata: { before: { shiftId: before.shiftId }, patch: req.body },
    });
    res.json(employee);
  },
);

employeesRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.EMPLOYEES_DELETE),
  (req, res) => {
    const principal = principalOf(req);
    repoFor(req).deleteEmployee(req.params.id);
    recordAudit(req, principal, {
      action: 'employee.delete',
      resource: 'employee',
      resourceId: req.params.id,
    });
    res.status(204).send();
  },
);
