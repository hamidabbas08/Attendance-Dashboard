import request from 'supertest';
import { setup, slackSigned, TestCtx } from './helpers';
import { store } from '../src/data/store';

let ctx: TestCtx;

beforeEach(async () => {
  ctx = await setup();
});

function eventBody(teamId: string, slackUser: string, text: string) {
  return {
    team_id: teamId,
    event: {
      type: 'message',
      user: slackUser,
      text,
      ts: String(Math.floor(new Date('2026-09-23T09:05:00Z').getTime() / 1000)),
    },
  };
}

describe('Slack webhook security & tenant isolation', () => {
  it('rejects an unsigned request with 401', async () => {
    const res = await request(ctx.app)
      .post('/api/slack/events')
      .send(eventBody('T_ACME', 'U_ACME_EMP', 'in'));
    expect(res.status).toBe(401);
  });

  it('rejects a request signed with the wrong secret', async () => {
    const body = eventBody('T_ACME', 'U_ACME_EMP', 'in');
    const raw = JSON.stringify(body);
    const res = await request(ctx.app)
      .post('/api/slack/events')
      .set('Content-Type', 'application/json')
      .set('x-slack-signature', 'v0=deadbeef')
      .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
      .send(raw);
    expect(res.status).toBe(401);
  });

  it('resolves the tenant from team_id and records attendance under that company', async () => {
    const body = eventBody('T_ACME', 'U_ACME_EMP', 'checking in');
    const { raw, ts, sig } = slackSigned(body);
    const res = await request(ctx.app)
      .post('/api/slack/events')
      .set('Content-Type', 'application/json')
      .set('x-slack-signature', sig)
      .set('x-slack-request-timestamp', ts)
      .send(raw);
    expect(res.status).toBe(200);
    expect(res.body.result.companyId).toBe(ctx.seed.companyA.companyId);
    expect(res.body.result.action).toBe('recorded');
  });

  it("never lets one workspace's event land in another company", async () => {
    // Company A's team id but an employee slack id that only exists in company B.
    const body = eventBody('T_ACME', 'U_GLOBEX_EMP', 'in');
    const { raw, ts, sig } = slackSigned(body);
    const res = await request(ctx.app)
      .post('/api/slack/events')
      .set('Content-Type', 'application/json')
      .set('x-slack-signature', sig)
      .set('x-slack-request-timestamp', ts)
      .send(raw);
    expect(res.status).toBe(200);
    // No matching employee in company A → no attendance created for B.
    expect(res.body.result.action).toBe('ignored_no_employee');
    const bEmp = ctx.seed.companyB.employeeId;
    const leaked = [...store.attendanceRecords.values()].some(
      (r) => r.employeeId === bEmp && r.date === '2026-09-23',
    );
    expect(leaked).toBe(false);
  });

  it('drops an event whose team maps to no company (404)', async () => {
    const body = eventBody('T_UNKNOWN', 'U_X', 'in');
    const { raw, ts, sig } = slackSigned(body);
    const res = await request(ctx.app)
      .post('/api/slack/events')
      .set('Content-Type', 'application/json')
      .set('x-slack-signature', sig)
      .set('x-slack-request-timestamp', ts)
      .send(raw);
    expect(res.status).toBe(404);
  });

  it('answers the url_verification challenge', async () => {
    const body = { type: 'url_verification', challenge: 'abc123' };
    const { raw, ts, sig } = slackSigned(body);
    const res = await request(ctx.app)
      .post('/api/slack/events')
      .set('Content-Type', 'application/json')
      .set('x-slack-signature', sig)
      .set('x-slack-request-timestamp', ts)
      .send(raw);
    expect(res.status).toBe(200);
    expect(res.body.challenge).toBe('abc123');
  });
});
