'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

// Module-level cache so navigating back to a page shows data instantly while it
// revalidates in the background — makes the app feel fast on repeat visits.
const cache = new Map<string, unknown>();

export function clearFetchCache(prefix?: string): void {
  if (!prefix) return cache.clear();
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
}

// How often to quietly re-fetch in the background so a change made elsewhere
// (e.g. HR updating an employee's shift or attendance) shows up without a manual
// reload. Kept short enough to feel live, long enough to stay cheap.
const DEFAULT_POLL_MS = 15000;

export function useFetch<T>(path: string, options?: { pollMs?: number }): {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
} {
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const cached = (cache.get(path) as T) ?? null;
  const [data, setData] = useState<T | null>(cached);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(cached === null);
  const [nonce, setNonce] = useState(0);

  // Keep a stable ref to the latest path so the background timers/listeners
  // always revalidate the current endpoint.
  const pathRef = useRef(path);
  pathRef.current = path;

  // Quietly re-fetch without flashing the skeleton; updates the shared cache so
  // every mounted view of the same endpoint stays in sync.
  const revalidate = useCallback(async () => {
    const p = pathRef.current;
    try {
      const d = await api<T>(p);
      cache.set(p, d);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const hit = (cache.get(path) as T) ?? null;
    setData(hit);
    setLoading(hit === null); // only show the skeleton when we have nothing cached
    api<T>(path)
      .then((d) => {
        if (!active) return;
        cache.set(path, d);
        setData(d);
        setError(null);
      })
      .catch((e) => active && setError(e as ApiError))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path, nonce]);

  // Background auto-refresh: poll on an interval, and revalidate immediately when
  // the tab regains focus or becomes visible — so HR/owner edits reach the
  // affected employee's portal on their own, with no manual reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFocus = () => {
      if (document.visibilityState !== 'hidden') revalidate();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const timer = pollMs > 0
      ? window.setInterval(() => {
          if (document.visibilityState !== 'hidden') revalidate();
        }, pollMs)
      : undefined;
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      if (timer) window.clearInterval(timer);
    };
  }, [pollMs, revalidate]);

  return {
    data,
    error,
    loading,
    reload: () => {
      cache.delete(path);
      setNonce((n) => n + 1);
    },
  };
}
