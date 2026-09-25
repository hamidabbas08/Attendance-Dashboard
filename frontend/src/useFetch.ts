import { useEffect, useState } from 'react';
import { api, ApiError } from './api';

export function useFetch<T>(path: string, deps: unknown[] = []): {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<T>(path)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e as ApiError))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}
