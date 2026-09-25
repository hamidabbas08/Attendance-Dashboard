# Multi-Tenant HR / Attendance SaaS — Architecture & Security Design

This document is the design contract for the system. It is written **before** the
implementation and every module in `backend/src` maps back to a section here.

The single most important property of this system:

> A user from Company A must NEVER be able to access, query, modify, or infer
> data belonging to Company B.

Tenant isolation and RBAC are enforced **server-side** at the data-access layer.
The frontend is treated as fully untrusted.

---

## 1. Database Schema

Every company-owned row carries an explicit `company_id`. The only rows without a
`company_id` are platform-level rows (the platform admin, platform settings).

Tables (see `backend/prisma/schema.prisma` for the authoritative definition):

| Table | Purpose | Tenant column |
|-------|---------|---------------|
| `companies` | One row per tenant | (is the tenant) |
| `users` | Auth identities (platform admin, owner, HR, employee) | `company_id` (nullable only for platform admin) |
| `roles` | Named roles | global catalogue |
| `permissions` | Granular permission catalogue | global catalogue |
| `role_permissions` | Role → permission matrix | global catalogue |
| `user_roles` | User → role assignment (scoped to a company) | `company_id` |
| `employees` | Employee profile (1:1 with a user of role employee) | `company_id` |
| `shifts` | Shift definitions (start/end/grace) | `company_id` |
| `attendance_rules` | Per-company attendance policy (working days, statuses) | `company_id` |
| `attendance_records` | Daily attendance rows | `company_id` |
| `slack_workspaces` | Slack team → company mapping + token | `company_id` |
| `slack_channels` | Tracked channels | `company_id` |
| `attendance_events` | Raw check-in/out events from Slack | `company_id` |
| `audit_logs` | Immutable audit trail of sensitive ops | `company_id` |

Key relationships:

```
companies 1───* users
companies 1───* employees        (employee.user_id → users.id)
companies 1───* shifts
employees *───1 shifts           (employee.shift_id)
companies 1───1 attendance_rules
companies 1───* attendance_records
companies 1───1 slack_workspaces (slack_team_id UNIQUE, globally)
attendance_records *───1 employees
```

`slack_workspaces.slack_team_id` is globally unique — it is the key used to resolve
an inbound Slack event to exactly one tenant.

`attendance_records` has a unique constraint on `(company_id, employee_id, date)`.

---

## 2. Roles

Four roles (`backend/src/rbac/roles.ts`):

| Role | Scope | Summary |
|------|-------|---------|
| `platform_admin` | Cross-tenant | The only role that may touch data across tenants. |
| `company_owner` | Single tenant | Founder. Full control of their own company. |
| `hr_manager` | Single tenant | Manage employees, shifts, rules, reports for their company. |
| `employee` | Single tenant | Read-only access to **their own** data only. |

A non-platform user is always bound to exactly one `company_id`, resolved
server-side from their identity — never from the request body.

---

## 3. Permissions

Granular, verb-scoped permissions (`backend/src/rbac/permissions.ts`):

```
company:view          company:update
employees:view        employees:create   employees:update   employees:delete
attendance:view_own   attendance:view_all   attendance:update
attendance_rules:view attendance_rules:create attendance_rules:update
shifts:view           shifts:create      shifts:update
reports:view          reports:export
users:view            users:create       users:update       users:delete
slack:view            slack:configure
audit:view
claude:query_own      claude:query_all
platform:manage
```

The application authorizes on **permissions**, not on role strings. There is no
`if (role === 'admin')` scattered through the code — role→permission mapping lives
in exactly one place.

---

## 4. Role → Permission Matrix

Defined once in `backend/src/rbac/roles.ts`.

| Permission | platform_admin | company_owner | hr_manager | employee |
|---|:--:|:--:|:--:|:--:|
| platform:manage | ✅ | | | |
| company:view | ✅ | ✅ | ✅ | |
| company:update | ✅ | ✅ | | |
| employees:view | ✅ | ✅ | ✅ | |
| employees:create | ✅ | ✅ | ✅ | |
| employees:update | ✅ | ✅ | ✅ | |
| employees:delete | ✅ | ✅ | ✅ | |
| users:view | ✅ | ✅ | | |
| users:create | ✅ | ✅ | | |
| users:update | ✅ | ✅ | | |
| users:delete | ✅ | ✅ | | |
| attendance:view_own | ✅ | ✅ | ✅ | ✅ |
| attendance:view_all | ✅ | ✅ | ✅ | |
| attendance:update | ✅ | ✅ | ✅ | |
| attendance_rules:* | ✅ | ✅ | ✅ | |
| shifts:* | ✅ | ✅ | ✅ | |
| reports:view / export | ✅ | ✅ | ✅ | |
| slack:view | ✅ | ✅ | | |
| slack:configure | ✅ | ✅ (own) | | |
| audit:view | ✅ | ✅ | | |
| claude:query_own | ✅ | ✅ | ✅ | ✅ |
| claude:query_all | ✅ | ✅ | ✅ | |

Platform admin holds every permission (it is a superset via `ALL_PERMISSIONS`).

---

## 5. Authentication Flow

1. `POST /api/auth/login` with `{ email, password }`.
2. Password verified against a per-user Argon2/scrypt hash (`backend/src/auth/passwords.ts`).
3. On success a signed JWT is issued containing **only** `{ sub: userId }` — no
   role, company, or permissions are trusted from the token payload beyond the
   subject id.
4. Every subsequent request carries `Authorization: Bearer <jwt>`.
5. `authenticate` middleware verifies the signature, loads the **current** user
   from the database, and derives `company_id`, roles, and permissions server-side.
   A revoked/disabled user is rejected even with a valid token.

Missing/invalid token → `401 Unauthorized`.

## 6. Tenant Resolution

`authenticate` builds a `Principal`:

```
Principal {
  userId
  companyId          // null only for platform_admin
  roles: Role[]
  permissions: Set<Permission>
  isPlatformAdmin
}
```

`companyId` comes from `users.company_id` in the DB, never from the request.
`req.principal` is the only source of truth for the caller's tenant.

## 7. Backend Authorization Middleware / Guards

- `authenticate` — 401 gate, attaches `req.principal`.
- `requirePermission(permission)` — 403 gate; checks `principal.permissions`.
- `TenantRepository` — a data layer that **requires** a `TenantContext` on every
  query and injects `WHERE company_id = ctx.companyId`. Non-admin callers
  physically cannot express a cross-tenant query. Platform admins use an explicit
  `crossTenant()` escape hatch that is itself permission-gated.
- `assertSameTenant(principal, resource)` — defence in depth: after a row is
  loaded it is re-checked so a mis-scoped query can never leak a foreign row
  (returns 403/404).

The security boundary is the **conjunction**:

```
requirePermission()      → does this role may do this verb at all?
TenantRepository scope   → only rows of the caller's company are ever fetched
assertSameTenant()       → the fetched row belongs to the caller's company
```

## 8. Slack Workspace → Company Mapping

```
Slack request
  → verify signature (signing secret, timestamp anti-replay)   [reject 401]
  → extract team_id
  → slack_workspaces.findByTeamId(team_id) → company_id         [reject 404 if none]
  → resolve employee by slack_user_id within that company
  → build TenantContext(company_id) and process attendance
  → persist attendance_event + attendance_record under company_id
```

An event whose `team_id` maps to no company is dropped — never processed against a
guessed or default tenant. Access tokens are stored server-side and never returned
to any API client.

## 9. API Route Protection

Every route is `authenticate` + `requirePermission(...)` + tenant-scoped repo.
Representative map:

```
POST   /api/auth/login                    public
GET    /api/companies                      platform:manage
GET    /api/companies/:id                  company:view      (self-tenant or admin)
GET    /api/employees                      employees:view
POST   /api/employees                      employees:create
GET    /api/attendance/me                  attendance:view_own
GET    /api/attendance                     attendance:view_all
GET    /api/shifts                         shifts:view
GET    /api/attendance-rules               attendance_rules:view
GET    /api/reports/attendance             reports:view
GET    /api/reports/attendance.csv         reports:export
GET    /api/slack/status                   slack:view
POST   /api/slack/configure                slack:configure
POST   /api/slack/events                   Slack-signed (no user auth)
POST   /api/claude/query                   claude:query_own
GET    /api/audit                          audit:view
```

Any `:id` that resolves to a foreign company yields 403/404, never the row.

## 10. Claude Data-Access Flow

Claude never receives raw DB access. `backend/src/claude/claudeQueryService.ts`:

```
Authenticated user
  → resolve company_id (server-side)
  → classify NL intent (own vs company-wide)
  → permission check:
        company-wide intent  requires claude:query_all
        own-only intent      requires claude:query_own
  → fetch ONLY the permitted, tenant-scoped rows
  → hand that minimal dataset to Claude with a tool/prompt
  → return the natural-language answer
```

An employee asking "Who was late today?" (a company-wide question) is denied the
company-wide dataset because they lack `attendance:view_all` / `claude:query_all`;
they can only ask about themselves.

## Security Requirements Coverage

- **Cross-tenant access** — TenantRepository + `assertSameTenant`.
- **IDOR** — object ids are always fetched through the tenant-scoped repo; a
  foreign id is indistinguishable from a non-existent one (404).
- **Privilege escalation** — role/permission derived server-side; clients cannot
  set their own role or permissions; role assignment is `users:update` gated.
- **Unauthorized attendance modification** — `attendance:update` gated + tenant scope.
- **Slack isolation** — team_id → single company; unknown team dropped.
- **Token safety** — Slack access tokens never serialized to API responses.
- **Audit integrity** — `audit_logs` are append-only; no route exposes update/delete.
- **Rate limiting** — login and Slack/Claude endpoints are rate limited.
