/**
 * Minimal scrin.io (formerly ScreenshotMonitor) REST API v2 client.
 *
 * Auth: every request carries an `X-SSM-Token` header (NOT a Bearer token).
 * The token must be the account OWNER's token (My Account → scrin.io API v2),
 * not an individual employee's — an employee-level token only sees that one
 * person's own data, which isn't enough to show everyone's activity.
 *
 * Source: the vendor's own in-app API docs (no public reference exists;
 * screenshotmonitor.com/account → "Read Documentation" under "scrin.io API v2
 * (beta)"), read directly off the docs page since nothing is indexed/public.
 *
 * Best-effort like the Slack client (backend/src/slack/api.ts): callers get
 * `null`/`[]` on any failure rather than a thrown error, since this is a
 * secondary data source the rest of the app doesn't depend on.
 */

const BASE_URL = 'https://screenshotmonitor.com/api/v2';

async function post<T>(token: string, path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      // The ASP.NET backend defaults to an XML 500 error without an explicit
      // Accept header — confirmed by testing directly against the real API —
      // which looked like "no data" everywhere (every email came back
      // unlinked) rather than the request actually failing.
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-SSM-Token': token },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface ScrinEmployment {
  id: number;
  name: string;
  email: string;
  registered: boolean;
  lastActive: number | null; // epoch seconds; null if never active
  payRate: number;
  activityStatus: 'online' | 'offline' | 'away' | string;
}

export interface ScrinCompany {
  id: number;
  name: string;
  isManager: boolean;
  employments: ScrinEmployment[];
  // weekStartDay: 0=Sun..6=Sat (confirmed from a real response: 1=Monday).
  // Used so "this week" matches what the company sees in scrin.io itself.
  config?: { weekStartDay: number | null };
}

interface CommonDataResponse {
  companies: ScrinCompany[];
}

/** All companies/employments visible to this token — used to map email -> employmentId. */
export async function getCommonData(token: string): Promise<ScrinCompany[]> {
  const data = await post<CommonDataResponse>(token, '/GetCommonData', {});
  return data?.companies ?? [];
}

export interface ScrinActivity {
  id: string; // guid
  employmentId: number;
  note: string | null;
  offline: boolean;
  from: number; // epoch seconds
  to: number; // epoch seconds
  projectId: string | null;
}

/** Time-tracked activity blocks for one or more employments over a date range each. */
export async function getActivities(
  token: string,
  ranges: { employmentId: number; from: number; to: number }[],
): Promise<ScrinActivity[]> {
  if (ranges.length === 0) return [];
  const data = await post<ScrinActivity[]>(token, '/GetActivities', ranges);
  return data ?? [];
}

export interface ScrinScreenshotApp {
  fromScreen: boolean;
  duration: number; // seconds in foreground
  applicationName: string;
}

export interface ScrinScreenshot {
  id: number;
  activityId: string;
  width: number;
  height: number;
  url: string;
  thumbUrl: string;
  taken: number; // epoch seconds
  activityLevel: number; // 0-100
  applications: ScrinScreenshotApp[];
}

/** Screenshots belonging to the given activity ids. */
export async function getScreenshots(token: string, activityIds: string[]): Promise<ScrinScreenshot[]> {
  if (activityIds.length === 0) return [];
  const data = await post<ScrinScreenshot[]>(token, '/GetScreenshots', activityIds);
  return data ?? [];
}
