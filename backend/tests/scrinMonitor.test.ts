// Force the monitor "on" and stub the external calls (scrin.io + Slack DM).
jest.mock('../src/scrin/service', () => ({ scrinEnabled: true }));
jest.mock('../src/scrin/client', () => ({ getCommonData: jest.fn() }));
jest.mock('../src/slack/api', () => ({ sendDirectMessage: jest.fn().mockResolvedValue(true) }));

import { setup, TestCtx } from './helpers';
import { store } from '../src/data/store';
import { runScrinMonitor } from '../src/scrin/monitor';
import { getCommonData } from '../src/scrin/client';
import { sendDirectMessage } from '../src/slack/api';

const mockedGetCommonData = getCommonData as jest.MockedFunction<typeof getCommonData>;
const mockedDM = sendDirectMessage as jest.MockedFunction<typeof sendDirectMessage>;

let ctx: TestCtx;
let employee: { id: string; email: string };

function companyWithStatus(email: string, status: string) {
  return [
    {
      id: 1,
      name: 'Acme',
      isManager: true,
      employments: [
        { id: 42, name: 'Emp', email, registered: true, lastActive: 0, payRate: 0, activityStatus: status },
      ],
    },
  ] as unknown as Awaited<ReturnType<typeof getCommonData>>;
}

beforeEach(async () => {
  ctx = await setup();
  mockedGetCommonData.mockReset();
  mockedDM.mockClear();
  mockedDM.mockResolvedValue(true);
  const companyId = ctx.seed.companyA.companyId;
  const e = [...store.employees.values()].find((x) => x.companyId === companyId && x.email);
  employee = { id: e!.id, email: e!.email };
});

function breaksFor() {
  return [...store.breaks.values()].filter((b) => b.employeeId === employee.id).sort((a, b) => a.startTs - b.startTs);
}

describe('scrin.io pause monitor', () => {
  it('opens a break + DMs on pause, and closes it on resume', async () => {
    // Baseline poll: tracking on. Establishes state, no break, no DM.
    mockedGetCommonData.mockResolvedValueOnce(companyWithStatus(employee.email, 'online'));
    await runScrinMonitor();
    expect(breaksFor()).toHaveLength(0);
    expect(mockedDM).not.toHaveBeenCalled();

    // Pause: online -> offline. Break opens and the employee is DMed.
    mockedGetCommonData.mockResolvedValueOnce(companyWithStatus(employee.email, 'offline'));
    await runScrinMonitor();
    let brks = breaksFor();
    expect(brks).toHaveLength(1);
    expect(brks[0].endTs).toBeNull(); // ongoing
    expect(brks[0].source).toBe('scrin_pause');
    expect(mockedDM).toHaveBeenCalledTimes(1);

    // Another paused poll must NOT open a second break.
    mockedGetCommonData.mockResolvedValueOnce(companyWithStatus(employee.email, 'offline'));
    await runScrinMonitor();
    expect(breaksFor()).toHaveLength(1);

    // Resume: offline -> online. The open break is closed.
    mockedGetCommonData.mockResolvedValueOnce(companyWithStatus(employee.email, 'online'));
    await runScrinMonitor();
    brks = breaksFor();
    expect(brks).toHaveLength(1);
    expect(brks[0].endTs).not.toBeNull();
    expect(mockedDM).toHaveBeenCalledTimes(1); // no DM on resume
  });
});
