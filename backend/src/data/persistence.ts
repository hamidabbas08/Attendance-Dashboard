import { Pool } from 'pg';
import { config } from '../config/env';
import { InMemoryStore, store } from './store';

/**
 * Durable persistence for the in-memory store.
 *
 * The whole application runs on the fast in-memory `store` (Maps). When a
 * Postgres `DATABASE_URL` is configured, we additionally snapshot that store to
 * a single JSONB row and restore it on boot — so every change made through the
 * app (shift times, roles, declared holidays, attendance edits, Slack links)
 * persists across redeploys. With no DATABASE_URL the app behaves exactly as
 * before (ephemeral in-memory), so local/dev and tests are unaffected.
 *
 * This deliberately avoids a full ORM rewrite: the synchronous repository and
 * all its logic stay as-is; we only serialize/deserialize the store's Maps.
 */

// The store's collections, as plain arrays, for (de)serialization. Keep this in
// sync with InMemoryStore's Map fields.
const COLLECTIONS = [
  'companies',
  'users',
  'employees',
  'shifts',
  'attendanceRules',
  'holidays',
  'attendanceRecords',
  'slackWorkspaces',
  'slackChannels',
  'attendanceEvents',
  'auditLogs',
] as const;
type Collection = (typeof COLLECTIONS)[number];

export const persistenceEnabled = Boolean(config.databaseUrl);

let pool: Pool | null = null;
let lastSaved = '';
let saving = false;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      // Managed Postgres (Neon/Supabase/Render) requires SSL; allow self-signed.
      ssl: /sslmode=disable/.test(config.databaseUrl) ? undefined : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

/** Serialize the store's Maps into a plain JSON-able object. */
export function serialize(s: InMemoryStore): string {
  const data: Record<string, unknown[]> = {};
  for (const name of COLLECTIONS) {
    data[name] = [...(s[name] as Map<string, unknown>).values()];
  }
  return JSON.stringify(data);
}

/** Replace the store's contents with a previously-serialized snapshot. */
export function hydrate(s: InMemoryStore, json: string): void {
  const data = JSON.parse(json) as Record<Collection, { id: string }[]>;
  s.reset();
  for (const name of COLLECTIONS) {
    const rows = data[name] ?? [];
    const map = s[name] as Map<string, { id: string }>;
    for (const row of rows) map.set(row.id, row);
  }
}

/**
 * Create the snapshot table and, if a snapshot exists, load it into the store.
 * Returns true if the store was hydrated from an existing snapshot (so the
 * caller should skip seeding). On any failure it logs and returns false, so the
 * app still boots (falling back to a fresh in-memory store).
 */
export async function loadSnapshot(s: InMemoryStore = store): Promise<boolean> {
  if (!persistenceEnabled) return false;
  try {
    const db = getPool();
    await db.query(
      'CREATE TABLE IF NOT EXISTS app_snapshot (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const res = await db.query<{ data: unknown }>('SELECT data FROM app_snapshot WHERE id = 1');
    if (res.rows.length === 0) return false;
    const json = JSON.stringify(res.rows[0].data);
    hydrate(s, json);
    lastSaved = serialize(s); // normalize so the first autosave is a no-op
    // eslint-disable-next-line no-console
    console.log(
      `Restored data from Postgres snapshot (${s.companies.size} companies, ` +
        `${s.employees.size} employees, ${s.attendanceRecords.size} records).`,
    );
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Snapshot load failed — starting from a fresh store:', (e as Error).message);
    return false;
  }
}

/** Write the current store to Postgres if it changed since the last save. */
export async function saveSnapshot(s: InMemoryStore = store): Promise<void> {
  if (!persistenceEnabled || saving) return;
  const json = serialize(s);
  if (json === lastSaved) return;
  saving = true;
  try {
    await getPool().query(
      `INSERT INTO app_snapshot (id, data, updated_at) VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [json],
    );
    lastSaved = json;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Snapshot save failed (will retry):', (e as Error).message);
  } finally {
    saving = false;
  }
}

/**
 * Start periodically persisting the store, and flush on shutdown. The interval
 * only writes when something actually changed, so it is cheap at this scale.
 */
export function startAutosave(s: InMemoryStore = store, intervalMs = 3000): void {
  if (!persistenceEnabled) return;
  setInterval(() => {
    void saveSnapshot(s);
  }, intervalMs).unref?.();

  const flush = () => {
    void saveSnapshot(s);
  };
  process.on('SIGTERM', flush);
  process.on('SIGINT', flush);
  process.on('beforeExit', flush);
}
