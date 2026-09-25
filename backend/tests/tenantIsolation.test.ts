import request from 'supertest';
import { auth, login, setup, TestCtx } from './helpers';

let ctx: TestCtx;
let ownerAToken: string;

beforeEach(async () => {
  ctx = await setup();
  ownerAToken = await login(ctx.app, 'owner@acme.test', ctx.seed.password);
});

describe('Tenant isolation — same tenant works, cross tenant is invisible', () => {
  it('lets Company A owner read their OWN company', async () => {
    const res = await request(ctx.app)
      .get(`/api/companies/${ctx.seed.companyA.companyId}`)
      .set(auth(ownerAToken));
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Acme Inc');
  });

  it("returns 404 (not 403) when A tries to read B's company — no existence leak", async () => {
    const res = await request(ctx.app)
      .get(`/api/companies/${ctx.seed.companyB.companyId}`)
      .set(auth(ownerAToken));
    expect(res.status).toBe(404);
  });

  it("hides B's employees from A entirely", async () => {
    const list = await request(ctx.app).get('/api/employees').set(auth(ownerAToken));
    expect(list.status).toBe(200);
    const ids: string[] = list.body.map((e: { id: string }) => e.id);
    expect(ids).toContain(ctx.seed.companyA.employeeId);
    expect(ids).not.toContain(ctx.seed.companyB.employeeId);
  });

  it("returns 404 when A fetches B's employee by id", async () => {
    const res = await request(ctx.app)
      .get(`/api/employees/${ctx.seed.companyB.employeeId}`)
      .set(auth(ownerAToken));
    expect(res.status).toBe(404);
  });

  it('scopes company-wide attendance to A only', async () => {
    const res = await request(ctx.app).get('/api/attendance').set(auth(ownerAToken));
    expect(res.status).toBe(200);
    for (const r of res.body) {
      expect(r.companyId).toBe(ctx.seed.companyA.companyId);
    }
  });

  it('lets the platform admin cross tenants and list all companies', async () => {
    const adminToken = await login(ctx.app, 'admin@platform.test', ctx.seed.password);
    const res = await request(ctx.app).get('/api/companies').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('forbids a company owner from listing all companies (platform-only)', async () => {
    const res = await request(ctx.app).get('/api/companies').set(auth(ownerAToken));
    expect(res.status).toBe(403);
  });
});
