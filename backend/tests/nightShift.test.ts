import { setup, TestCtx } from './helpers';
import { store } from '../src/data/store';
import { recordMessage } from '../src/slack/eventHandler';
import { SlackWorkspace } from '../src/data/types';

let ctx: TestCtx;

beforeEach(async () => {
  ctx = await setup();
});

// Company timezone is PKT (UTC+5). Build a Slack ts (seconds) for a given PKT
// wall-clock time by subtracting the 5h offset to get the UTC instant.
function tsForPkt(iso: string): string {
  const utc = Date.parse(`${iso}Z`) - 5 * 3600 * 1000;
  return String(Math.floor(utc / 1000));
}

function acmeWorkspace(): SlackWorkspace {
  const companyId = ctx.seed.companyA.companyId;
  const ws = [...store.slackWorkspaces.values()].find((w) => w.companyId === companyId);
  if (!ws) throw new Error('no workspace');
  return ws;
}

function empRecords() {
  const companyId = ctx.seed.companyA.companyId;
  const emp = [...store.employees.values()].find(
    (e) => e.companyId === companyId && e.slackUserId === 'U_ACME_EMP',
  );
  return [...store.attendanceRecords.values()]
    .filter((r) => r.employeeId === emp!.id)
    .sort((a, b) => a.date.localeCompare(b.date));
}

describe('Night shift crossing midnight', () => {
  it('attaches an after-midnight sign-out to the previous day\'s open shift', async () => {
    const ws = acmeWorkspace();
    // Sign in at 4:00 PM PKT on Sep 23.
    await recordMessage(ws, { user: 'U_ACME_EMP', text: 'sign in', ts: tsForPkt('2026-09-23T16:00:00') });
    // Sign out at 2:42 AM PKT on Sep 24 — belongs to Sep 23's night shift.
    await recordMessage(ws, { user: 'U_ACME_EMP', text: 'sign out', ts: tsForPkt('2026-09-24T02:42:00') });

    const recs = empRecords();
    const sep23 = recs.find((r) => r.date === '2026-09-23')!;
    expect(sep23.checkIn).toBe('16:00');
    expect(sep23.checkOut).toBe('02:42');
    // The sign-out did not create a bogus Sep 24 record.
    expect(recs.find((r) => r.date === '2026-09-24')).toBeUndefined();
  });

  it('pairs correctly even when the next day\'s sign-in is processed first', async () => {
    const ws = acmeWorkspace();
    // Out-of-order: today's (Sep 24) 4:00 PM sign-in arrives before the 2:42 AM sign-out.
    await recordMessage(ws, { user: 'U_ACME_EMP', text: 'sign in', ts: tsForPkt('2026-09-23T16:00:00') });
    await recordMessage(ws, { user: 'U_ACME_EMP', text: 'sign in', ts: tsForPkt('2026-09-24T16:00:00') });
    // A 2:42 AM Sep 24 sign-out must NOT pair with the 4 PM Sep 24 sign-in (can't
    // sign out before signing in) — it belongs to Sep 23's open shift.
    const res = await recordMessage(ws, { user: 'U_ACME_EMP', text: 'sign out', ts: tsForPkt('2026-09-24T02:42:00') });

    const recs = empRecords();
    const sep23 = recs.find((r) => r.date === '2026-09-23')!;
    const sep24 = recs.find((r) => r.date === '2026-09-24')!;
    expect(res.action).toBe('recorded');
    expect(sep23.checkOut).toBe('02:42'); // paired to the right day
    expect(sep24.checkIn).toBe('16:00');
    expect(sep24.checkOut).toBeNull(); // today's shift still open — no bogus sign-out
  });

  it('ignores a lone sign-out that cannot pair to any open shift', async () => {
    const ws = acmeWorkspace();
    const res = await recordMessage(ws, { user: 'U_ACME_EMP', text: 'sign out', ts: tsForPkt('2026-09-24T02:42:00') });
    expect(res.action).toBe('ignored_unpaired_checkout');
    // No Sep 23/24 records exist to attach to, and none were created.
    const recs = empRecords();
    expect(recs.find((r) => r.date === '2026-09-23')).toBeUndefined();
    expect(recs.find((r) => r.date === '2026-09-24')).toBeUndefined();
  });
});
