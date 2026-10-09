jest.mock('../src/config/env', () => ({
  config: { scrinApiKey: 'test-token', attendanceTzOffsetMinutes: 300 }, // PKT, UTC+5
}));
jest.mock('../src/scrin/client');

import { getActivities, getCommonData, getScreenshots } from '../src/scrin/client';
import { findEmploymentId, getDayActivity, getOverview } from '../src/scrin/service';

const mockCommon = jest.mocked(getCommonData);
const mockActivities = jest.mocked(getActivities);
const mockScreenshots = jest.mocked(getScreenshots);

function employment(id: number, email: string, lastActive: number | null = null) {
  return { id, name: 'X', email, registered: true, lastActive, payRate: 0, activityStatus: 'online' as const };
}
function act(id: string, from: number, to: number, note: string | null = null, offline = false) {
  return { id, employmentId: 458, note, offline, from, to, projectId: null };
}

describe('scrin service', () => {
  beforeEach(() => {
    mockCommon.mockResolvedValue([
      {
        id: 1, name: 'Stellar Stack', isManager: true, config: { weekStartDay: 1 },
        employments: [employment(458, 'Alice@X.test', 1791548809)],
      },
    ]);
    mockScreenshots.mockResolvedValue([]);
  });

  describe('findEmploymentId', () => {
    it('matches by email, case-insensitively', async () => {
      expect(await findEmploymentId('alice@x.test')).toBe(458);
    });

    it('returns null for an unlinked email', async () => {
      expect(await findEmploymentId('nobody@x.test')).toBeNull();
    });
  });

  describe('getDayActivity', () => {
    it('groups consecutive same-note activities into one block with merged screenshots', async () => {
      mockActivities.mockResolvedValue([
        act('a1', 1000, 1900, 'Writing docs'),
        act('a2', 1900, 2300, 'Writing docs'), // same note, contiguous — merges with a1
        act('a3', 3000, 3200, 'Reviewing PR'), // different note — its own block
      ]);
      mockScreenshots.mockResolvedValue([
        { id: 1, activityId: 'a1', width: 10, height: 10, url: 'u1', thumbUrl: 't1', taken: 1050, activityLevel: 90, applications: [] },
        { id: 2, activityId: 'a2', width: 10, height: 10, url: 'u2', thumbUrl: 't2', taken: 2000, activityLevel: 80, applications: [] },
      ]);

      const result = await getDayActivity('alice@x.test', '2026-01-15');
      expect(result.linked).toBe(true);
      expect(result.totalSeconds).toBe(900 + 400 + 200);
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0]).toMatchObject({ note: 'Writing docs', from: 1000, to: 2300 });
      expect(result.blocks[0].screenshots).toHaveLength(2);
      expect(result.blocks[1]).toMatchObject({ note: 'Reviewing PR', from: 3000, to: 3200 });
    });

    it('is not linked when the email has no matching employment, and makes no activity/screenshot calls', async () => {
      const result = await getDayActivity('nobody@x.test', '2026-01-15');
      expect(result).toEqual({ linked: false, totalSeconds: 0, blocks: [] });
      expect(mockActivities).not.toHaveBeenCalled();
    });
  });

  describe('getOverview', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T10:00:00.000Z')); // 2026-01-15 15:00 PKT
    });
    afterEach(() => jest.useRealTimers());

    it('buckets today/yesterday/week/month from one fetch, and lists active days', async () => {
      const r15 = localRange('2026-01-15');
      const r14 = localRange('2026-01-14');
      const r10 = localRange('2026-01-10');
      mockActivities.mockResolvedValue([
        act('a1', r15.from, r15.to), // today
        act('a2', r14.from, r14.to), // yesterday
        act('a3', r10.from, r10.to), // earlier this month, not this week (Mon Jan 12 start)
      ]);

      const result = await getOverview('alice@x.test', '2026-01');
      expect(result.linked).toBe(true);
      expect(result.lastActive).toBe(1791548809);
      expect(result.todaySeconds).toBe(86400);
      expect(result.yesterdaySeconds).toBe(86400);
      expect(result.weekSeconds).toBe(86400 * 2); // today + yesterday only (week starts Mon Jan 12)
      expect(result.monthSeconds).toBe(86400 * 3); // all three
      expect(result.activeDays).toEqual(['2026-01-10', '2026-01-14', '2026-01-15']);
    });

    it('is not linked when unmatched, without calling GetActivities', async () => {
      const result = await getOverview('nobody@x.test');
      expect(result.linked).toBe(false);
      expect(mockActivities).not.toHaveBeenCalled();
    });
  });
});

// Mirrors the service's own local-day boundary math (PKT, UTC+5) for building
// fixture activities that span an exact day.
function localRange(date: string): { from: number; to: number } {
  const utcMidnight = Date.parse(`${date}T00:00:00.000Z`);
  const localMidnightUtcMs = utcMidnight - 300 * 60 * 1000;
  return { from: Math.floor(localMidnightUtcMs / 1000), to: Math.floor(localMidnightUtcMs / 1000) + 86400 };
}
