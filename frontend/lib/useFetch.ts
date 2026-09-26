'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from './api';

// Module-level cache so navigating back to a page shows data instantly while it
// revalidates in the background — makes the app feel fast on repeat visits.
const cache = new Map<string, unknown>();

export function clearFetchCache(prefix?: string): void {
  if (!prefix) return cache.clear();
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
}

export function useFetch<T>(path: string): {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
} {
  const cached = (cache.get(path) as T) ?? null;
  const [data, setData] = useState<T | null>(cached);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(cached === null);
  const [nonce, setNonce] = useState(0);

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
