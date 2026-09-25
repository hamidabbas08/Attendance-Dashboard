import { resolveSlackLogin } from '../src/auth/slackOAuth';
import { verifyToken } from '../src/auth/tokens';
import { seedDatabase, SeedResult } from '../src/data/seed';
import { store } from '../src/data/store';

let seed: SeedResult;

beforeEach(async () => {
  seed = await seedDatabase(store);
});

describe('Sign in with Slack — tenant-scoped identity resolution', () => {
  const noProvision = { autoProvision: false };

  it('signs in the employee whose Slack user id matches, in their own company', () => {
    const { token, userId } = resolveSlackLogin({
      teamId: seed.companyA.slackTeamId,
      userId: 'U_ACME_EMP',
      email: null,
      name: null,
      teamName: null,
    });
    expect(userId).toBe(seed.companyA.employeeUserId);
    expect(verifyToken(token).sub).toBe(seed.companyA.employeeUserId);
  });

  it('rejects an unlinked workspace when auto-provisioning is off', () => {
    expect(() =>
      resolveSlackLogin(
        { teamId: 'T_UNKNOWN', userId: 'U_X', email: null, name: null, teamName: null },
        noProvision,
      ),
    ).toThrow(/not linked to a company/);
  });

  it("rejects an unknown Slack user (auto-provision off) in an existing company", () => {
    // Company A's team, but a Slack user id that only exists in company B.
    expect(() =>
      resolveSlackLogin(
        {
          teamId: seed.companyA.slackTeamId,
          userId: 'U_GLOBEX_EMP',
          email: null,
          name: null,
          teamName: null,
        },
        noProvision,
      ),
    ).toThrow(/No active account/);
  });

  it('falls back to email match within the SAME company and links the Slack id', () => {
    const { userId } = resolveSlackLogin({
      teamId: seed.companyA.slackTeamId,
      userId: 'U_NEW_OWNER',
      email: 'owner@acme.test',
      name: 'Acme Owner',
      teamName: null,
    });
    expect(userId).toBe(seed.companyA.ownerId);
    expect(store.users.get(seed.companyA.ownerId)?.slackUserId).toBe('U_NEW_OWNER');
  });

  it('does NOT match an email that belongs to a different tenant', () => {
    // Company B's workspace, but company A's owner email — must not cross tenants
    // (auto-provision off → rejected rather than silently cross tenants).
    expect(() =>
      resolveSlackLogin(
        {
          teamId: seed.companyB.slackTeamId,
          userId: 'U_NEW',
          email: 'owner@acme.test',
          name: null,
          teamName: null,
        },
        noProvision,
      ),
    ).toThrow(/No active account/);
  });
});

describe('Sign in with Slack — auto-provisioning (default)', () => {
  it('creates a new isolated company + owner for an unlinked workspace', () => {
    const before = store.companies.size;
    const { userId } = resolveSlackLogin({
      teamId: 'T_STELLAR',
      userId: 'U_FOUNDER',
      email: 'founder@stellar.test',
      name: 'Founder',
      teamName: 'Stellar Stack',
    });
    expect(store.companies.size).toBe(before + 1);
    const owner = store.users.get(userId)!;
    expect(owner.roles).toContain('company_owner');
    // The workspace is now linked to the new company.
    const ws = [...store.slackWorkspaces.values()].find((w) => w.slackTeamId === 'T_STELLAR');
    expect(ws?.companyId).toBe(owner.companyId);
    // A second login from the SAME team reuses that company (no duplicate).
    const second = resolveSlackLogin({
      teamId: 'T_STELLAR',
      userId: 'U_FOUNDER',
      email: 'founder@stellar.test',
      name: 'Founder',
      teamName: 'Stellar Stack',
    });
    expect(second.userId).toBe(userId);
    expect(store.companies.size).toBe(before + 1);
  });

  it('adds a new workspace member as an employee of the existing company', () => {
    const first = resolveSlackLogin({
      teamId: 'T_NEWCO',
      userId: 'U_A',
      email: 'a@newco.test',
      name: 'A',
      teamName: 'NewCo',
    });
    const ownerCompany = store.users.get(first.userId)!.companyId;
    const second = resolveSlackLogin({
      teamId: 'T_NEWCO',
      userId: 'U_B',
      email: 'b@newco.test',
      name: 'B',
      teamName: 'NewCo',
    });
    const member = store.users.get(second.userId)!;
    expect(member.companyId).toBe(ownerCompany); // same tenant
    expect(member.roles).toContain('employee');
    expect(member.roles).not.toContain('company_owner');
  });
});
