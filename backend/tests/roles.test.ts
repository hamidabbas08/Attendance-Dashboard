import request from 'supertest';
import { auth, login, setup, TestCtx } from './helpers';

let ctx: TestCtx;

beforeEach(async () => {
  ctx = await setup();
});

describe('Role permissions via the API (401/403 boundaries)', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(ctx.app).get('/api/employees');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token with 401', async () => {
    const res = await request(ctx.app).get('/api/employees').set(auth('not-a-real-token'));
    expect(res.status).toBe(401);
  });

  describe('Founder / company owner', () => {
    it('can manage employees, rules, users and slack', async () => {
      const t = await login(ctx.app, 'owner@acme.test', ctx.seed.password);
      expect((await request(ctx.app).get('/api/employees').set(auth(t))).status).toBe(200);
      expect((await request(ctx.app).get('/api/slack/status').set(auth(t))).status).toBe(200);
      expect((await request(ctx.app).get('/api/audit').set(auth(t))).status).toBe(200);
      expect(
        (await request(ctx.app).put('/api/attendance-rules').set(auth(t)).send({ workingDays: [1, 2, 3, 4, 5, 6] })).status,
      ).toBe(200);
    });
  });

  describe('HR manager', () => {
    it('can manage employees and reports but NOT platform/users/slack config', async () => {
      const t = await login(ctx.app, 'hr@acme.test', ctx.seed.password);
      expect((await request(ctx.app).get('/api/employees').set(auth(t))).status).toBe(200);
      expect((await request(ctx.app).get('/api/reports/attendance').set(auth(t))).status).toBe(200);
      expect((await request(ctx.app).get('/api/users').set(auth(t))).status).toBe(403);
      expect((await request(ctx.app).get('/api/companies').set(auth(t))).status).toBe(403);
      expect(
        (await request(ctx.app).post('/api/slack/configure').set(auth(t)).send({ slackTeamId: 'x', workspaceName: 'y', accessToken: 'z' })).status,
      ).toBe(403);
    });
  });

  describe('Employee', () => {
    it('can view only their own attendance', async () => {
      const t = await login(ctx.app, 'employee@acme.test', ctx.seed.password);
      const me = await request(ctx.app).get('/api/attendance/me').set(auth(t));
      expect(me.status).toBe(200);
      expect(Array.isArray(me.body)).toBe(true);
      for (const r of me.body) expect(r.employeeId).toBe(ctx.seed.companyA.employeeId);
    });

    it('is blocked from employees, reports, shifts, rules and audit', async () => {
      const t = await login(ctx.app, 'employee@acme.test', ctx.seed.password);
      for (const path of ['/api/employees', '/api/reports/attendance', '/api/shifts', '/api/attendance-rules', '/api/audit']) {
        expect((await request(ctx.app).get(path).set(auth(t))).status).toBe(403);
      }
    });
  });

  describe('Platform admin', () => {
    it('can list companies and create a new tenant', async () => {
      const t = await login(ctx.app, 'admin@platform.test', ctx.seed.password);
      const create = await request(ctx.app)
        .post('/api/companies')
        .set(auth(t))
        .send({ name: 'Initech', slug: 'initech' });
      expect(create.status).toBe(201);
    });
  });
});
