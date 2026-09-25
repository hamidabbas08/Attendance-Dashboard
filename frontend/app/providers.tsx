'use client';

import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { Login } from './login';
import { Shell } from './shell';

function Loading() {
  return <div className="max-w-sm mx-auto mt-20 text-muted">Loading…</div>;
}

/**
 * Gate: waits for the persisted store to hydrate, re-validates the token once,
 * then shows the login screen or the app shell.
 */
export function Providers({ children }: { children: ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.me);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    // After hydration, refresh the profile so server-side role/permission
    // changes take effect even though `me` was restored from storage.
    if (hydrated && token) fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!hydrated) return <Loading />;
  if (token && !me) return <Loading />; // token present, profile loading
  if (!me) return <Login />;
  return <Shell>{children}</Shell>;
}
