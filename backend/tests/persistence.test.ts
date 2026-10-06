import { seedDatabase } from '../src/data/seed';
import { InMemoryStore, store } from '../src/data/store';
import { serialize, hydrate } from '../src/data/persistence';

beforeEach(async () => {
  store.reset();
  await seedDatabase(store);
});

describe('Snapshot persistence (serialize/hydrate)', () => {
  it('round-trips the whole store, preserving edits', () => {
    // Make an edit like HR would: change a shift's hours.
    const shift = [...store.shifts.values()][0];
    store.shifts.set(shift.id, { ...shift, startTime: '13:00', endTime: '22:00' });

    const snapshot = serialize(store);

    // Simulate a redeploy: brand-new empty store, then restore from the snapshot.
    const fresh = new InMemoryStore();
    hydrate(fresh, snapshot);

    expect(fresh.companies.size).toBe(store.companies.size);
    expect(fresh.users.size).toBe(store.users.size);
    expect(fresh.employees.size).toBe(store.employees.size);
    expect(fresh.attendanceRecords.size).toBe(store.attendanceRecords.size);

    const restoredShift = fresh.shifts.get(shift.id);
    expect(restoredShift?.startTime).toBe('13:00');
    expect(restoredShift?.endTime).toBe('22:00');
  });

  it('restores holidays and roles so they survive a redeploy', () => {
    const company = [...store.companies.values()][0];
    const hid = store.id();
    store.holidays.set(hid, {
      id: hid,
      companyId: company.id,
      date: '2026-07-24',
      name: 'Company Day',
      createdAt: store.now(),
      updatedAt: store.now(),
    });
    const user = [...store.users.values()].find((u) => u.companyId === company.id)!;
    store.users.set(user.id, { ...user, roles: ['hr_manager', 'manager'] });

    const fresh = new InMemoryStore();
    hydrate(fresh, serialize(store));

    expect(fresh.holidays.get(hid)?.date).toBe('2026-07-24');
    expect(fresh.users.get(user.id)?.roles).toEqual(['hr_manager', 'manager']);
  });
});
