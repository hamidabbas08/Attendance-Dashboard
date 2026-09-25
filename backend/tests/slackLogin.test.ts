import { resolveSlackLogin } from '../src/auth/slackOAuth';
import { verifyToken } from '../src/auth/tokens';
import { seedDatabase, SeedResult } from '../src/data/seed';
import { store } from '../src/data/store';

let seed: SeedResult;

beforeEach(async () => {
  seed = await seedDatabase(store);
});

describe('Sign in with Slack — tenant-scoped identity resolution', () => {
  it('signs in the employee whose Slack user id matches, in their own company', () => {
    const { token, userId } = resolveSlackLogin({
      teamId: seed.companyA.slackTeamId,
      userId: 'U_ACME_EMP',
      email: null,
      name: null,
    });
    expect(userId).toBe(seed.companyA.employeeUserId);
    expect(verifyToken(token).sub).toBe(seed.companyA.employeeUserId);
  });

  it('rejects a Slack workspace not linked to any company', () => {
    expect(() =>
      resolveSlackLogin({ teamId: 'T_UNKNOWN', userId: 'U_X', email: null, name: null }),
    ).toThrow(/not linked to a company/);
  });

  it("rejects a Slack user that has no account in the workspace's company", () => {
    // Company A's team, but a Slack user id that only exists in company B.
    expect(() =>
      resolveSlackLogin({
        teamId: seed.companyA.slackTeamId,
        userId: 'U_GLOBEX_EMP',
        email: null,
        name: null,
      }),
    ).toThrow(/No active account/);
  });

  it('falls back to email match within the SAME company and links the Slack id', () => {
    const { userId } = resolveSlackLogin({
      teamId: seed.companyA.slackTeamId,
      userId: 'U_NEW_OWNER',
      email: 'owner@acme.test',
      name: 'Acme Owner',
    });
    expect(userId).toBe(seed.companyA.ownerId);
    // The Slack id is now linked for future direct matches.
    expect(store.users.get(seed.companyA.ownerId)?.slackUserId).toBe('U_NEW_OWNER');
  });

  it('does NOT match an email that belongs to a different tenant', () => {
    // Company B's workspace, but company A's owner email — must not cross tenants.
    expect(() =>
      resolveSlackLogin({
        teamId: seed.companyB.slackTeamId,
        userId: 'U_NEW',
        email: 'owner@acme.test',
        name: null,
      }),
    ).toThrow(/No active account/);
  });
});
