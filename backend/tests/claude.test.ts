import request from 'supertest';
import { auth, login, setup, TestCtx } from './helpers';

let ctx: TestCtx;

beforeEach(async () => {
  ctx = await setup();
});

describe('Claude data-access flow — permission-gated & tenant-scoped', () => {
  it('lets an employee ask about THEIR OWN attendance', async () => {
    const t = await login(ctx.app, 'employee@acme.test', ctx.seed.password);
    const res = await request(ctx.app)
      .post('/api/claude/query')
      .set(auth(t))
      .send({ question: 'How many times was I late?' });
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('own');
  });

  it('DENIES an employee a company-wide question with 403', async () => {
    const t = await login(ctx.app, 'employee@acme.test', ctx.seed.password);
    const res = await request(ctx.app)
      .post('/api/claude/query')
      .set(auth(t))
      .send({ question: 'Who was late today?' });
    expect(res.status).toBe(403);
  });

  it('lets HR ask company-wide questions', async () => {
    const t = await login(ctx.app, 'hr@acme.test', ctx.seed.password);
    const res = await request(ctx.app)
      .post('/api/claude/query')
      .set(auth(t))
      .send({ question: 'Who was late this week?' });
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('company');
    expect(typeof res.body.answer).toBe('string');
  });

  it("HR's company-wide answer only reflects their own tenant's data", async () => {
    const hrA = await login(ctx.app, 'hr@acme.test', ctx.seed.password);
    const resA = await request(ctx.app)
      .post('/api/claude/query')
      .set(auth(hrA))
      .send({ question: 'How many employees were late this month?' });
    expect(resA.status).toBe(200);
    // Company A seed has exactly 2 attendance records. If B's data leaked the
    // dataset would be 4. Isolation means Claude only ever sees A's 2 rows.
    expect(resA.body.recordCount).toBe(2);
    expect(resA.body.answer).toContain('1'); // exactly one of them is 'late'
  });
});
