# Multi-Tenant HR / Attendance SaaS

A production-ready, multi-tenant HR & attendance platform for software companies,
integrated with Slack and Claude. Each company is an isolated tenant: **a user from
Company A can never access, query, modify, or infer data belonging to Company B.**

Isolation and RBAC are enforced **server-side** at the data-access layer. The
frontend is treated as fully untrusted.

> Full design rationale — schema, roles, permission matrix, auth flow, tenant
> resolution, guards, Slack mapping, route protection and the Claude data-access
> flow — is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository layout

```
backend/    Node + TypeScript + Express API (RBAC, tenant isolation, Slack, Claude)
  prisma/   PostgreSQL schema (production data model)
  src/      Application code (see below)
  tests/    Security-focused test suite (46 tests)
frontend/   React + Vite dashboard with permission-driven navigation
docs/       Architecture & security design
```

### Backend modules

| Path | Responsibility |
|------|----------------|
| `src/rbac/` | Permissions, roles, role→permission matrix, `can()` decision fn, `Principal` |
| `src/data/` | Domain types, in-memory store, **`TenantRepository`** (physical tenant scoping), `TenantContext`, seed |
| `src/auth/` | scrypt password hashing, JWT issue/verify, login + principal resolution |
| `src/middleware/` | `authenticate` (401), `requirePermission` (403), tenant repo factories, rate limiting, validation, error handling |
| `src/attendance/` | Configurable, per-shift attendance status engine |
| `src/slack/` | Slack signature verification + `team_id → company` tenant resolution |
| `src/claude/` | Permission-gated, tenant-scoped Claude data-access flow |
| `src/audit/` | Append-only audit logging |
| `src/modules/` | Express routers per resource |

## The three-layer security boundary

Every protected operation passes through all three:

```
requirePermission(perm)   →  Does the caller's ROLE grant this action?      (403)
TenantRepository scope     →  Only rows of the caller's company are fetched   (data layer)
assertOwned / getX(id)     →  A loaded row is re-checked to belong to caller  (404, no leak)
```

A foreign object id is indistinguishable from a non-existent one (returns `404`),
which closes the IDOR information leak. `company_id` is **never** taken from the
client — it is derived from the authenticated session.

## Running

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev          # starts on :4000 with the in-memory adapter + seeded demo tenants
npm test             # runs the 46-test security suite
```

The default `DATA_ADAPTER=memory` runs the whole app with no database and seeds
two demo tenants (Acme, Globex) plus a platform admin. Demo logins (password
`Password123!`):

| Email | Role |
|-------|------|
| `admin@platform.test` | Platform Admin |
| `owner@acme.test` | Company Owner / Founder |
| `hr@acme.test` | HR Manager |
| `employee@acme.test` | Employee |

For production, set `DATA_ADAPTER=prisma`, point `DATABASE_URL` at PostgreSQL, and
run `npm run prisma:migrate`. The Prisma schema in `backend/prisma/schema.prisma`
is the authoritative production data model.

### Frontend

```bash
cd frontend
npm install
npm run dev          # starts on :5173, proxies /api to the backend
```

## Tests

The suite (`backend/tests`) is deliberately security-first and runs with no
external services:

- `rbac.test.ts` — role/permission matrix and the `can()` decision function
- `tenantIsolation.test.ts` — same-tenant access works; cross-tenant is invisible (404)
- `idor.test.ts` — IDOR & privilege-escalation attempts are rejected
- `roles.test.ts` — founder / HR / employee / platform-admin API boundaries (401/403)
- `slack.test.ts` — signature verification and Slack workspace isolation
- `claude.test.ts` — the permission-gated Claude data-access flow
- `attendanceEngine.test.ts` — configurable per-shift status calculation

```
Test Suites: 7 passed
Tests:       46 passed
```

## Security properties enforced

- **Multi-tenant isolation** — `TenantRepository` injects the tenant filter on every query.
- **RBAC** — centralized permissions; no scattered `if (role === 'admin')` checks.
- **No trust in client input** — `company_id` / `user_id` / `role` come from the session, never the request.
- **IDOR-safe** — foreign ids resolve to `404`.
- **Slack isolation** — an event's `team_id` resolves to exactly one company; unknown teams are dropped.
- **Token safety** — Slack access tokens and password hashes are never serialized to clients.
- **Claude scoping** — Claude only ever receives the permission-filtered, tenant-scoped dataset.
- **Audit integrity** — audit logs are append-only (no update/delete path).
- **Rate limiting** on login, Slack events, and Claude queries.
