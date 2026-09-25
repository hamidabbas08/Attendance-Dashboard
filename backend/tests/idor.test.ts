import request from 'supertest';
import { auth, login, setup, TestCtx } from './helpers';

let ctx: TestCtx;

beforeEach(async () => {
  ctx = await setup();
});

describe('IDOR / privilege escalation attempts', () => {
  it("blocks HR of A from modifying B's employee via a guessed id", async () => {
    const hrA = await login(ctx.app, 'hr@acme.test', ctx.seed.password);
    const res = await request(ctx.app)
      .patch(`/api/employees/${ctx.seed.companyB.employeeId}`)
      .set(auth(hrA))
      .send({ name: 'Hacked' });
    expect(res.status).toBe(404);
  });

  it("blocks HR of A from deleting B's employee", async () => {
    const hrA = await login(ctx.app, 'hr@acme.test', ctx.seed.password);
    const res = await request(ctx.app)
      .delete(`/api/employees/${ctx.seed.companyB.employeeId}`)
      .set(auth(hrA));
    expect(res.status).toBe(404);
  });

  it('ignores a client-supplied company_id and uses the session tenant', async () => {
    const hrA = await login(ctx.app, 'hr@acme.test', ctx.seed.password);
    // Attempt to smuggle company B's id into the body.
    const res = await request(ctx.app)
      .post('/api/employees')
      .set(auth(hrA))
      .send({ name: 'Mallory', email: 'm@x.test', companyId: ctx.seed.companyB.companyId });
    expect(res.status).toBe(201);
    // The created employee is bound to A regardless of the smuggled id.
    expect(res.body.companyId).toBe(ctx.seed.companyA.companyId);
  });

  it('prevents an employee from viewing company-wide attendance', async () => {
    const emp = await login(ctx.app, 'employee@acme.test', ctx.seed.password);
    const res = await request(ctx.app).get('/api/attendance').set(auth(emp));
    expect(res.status).toBe(403);
  });

  it('prevents an employee from creating employees (privilege escalation)', async () => {
    const emp = await login(ctx.app, 'employee@acme.test', ctx.seed.password);
    const res = await request(ctx.app)
      .post('/api/employees')
      .set(auth(emp))
      .send({ name: 'x', email: 'x@x.test' });
    expect(res.status).toBe(403);
  });

  it('prevents granting platform_admin through the user API', async () => {
    const ownerA = await login(ctx.app, 'owner@acme.test', ctx.seed.password);
    const res = await request(ctx.app)
      .post('/api/users')
      .set(auth(ownerA))
      .send({
        name: 'Escalated',
        email: 'esc@acme.test',
        password: 'Password123!',
        roles: ['platform_admin'],
      });
    // Rejected by schema validation — platform_admin is not an assignable role.
    expect(res.status).toBe(422);
  });
});
