'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { Login } from './login';
import { Shell } from './shell';

function Loading() {
  return <div className="max-w-sm mx-auto mt-20 text-muted">Loading…</div>;
}

// Human-readable messages for the error codes the backend redirects with.
const AUTH_ERRORS: Record<string, string> = {
  slack_not_configured: 'Slack sign-in is not configured on the server yet.',
  invalid_state: 'Sign-in session expired. Please try again.',
  missing_code: 'Slack did not return an authorization code.',
  login_failed: 'Could not sign you in with Slack.',
  access_denied: 'Slack sign-in was cancelled.',
};

/**
 * Gate: renders a stable placeholder until the component has mounted on the
 * client (persisted state is read synchronously by then), captures a token or
 * error handed back by the Slack OAuth redirect, then shows login or the shell.
 *
 * We gate on a local `mounted` flag rather than a store flag so the gate can
 * never get stuck if persist's rehydrate callback misbehaves, and so the
 * server render (always `Loading`) matches the first client render.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.me);

  useEffect(() => {
    const store = useAuthStore.getState();
    const url = new URL(window.location.href);
    const redirectToken = url.searchParams.get('token');
    const authError = url.searchParams.get('auth_error');

    if (redirectToken) {
      store.setSession(redirectToken);
    } else if (authError) {
      store.setAuthError(AUTH_ERRORS[authError] ?? 'Sign-in failed.');
    } else if (store.token) {
      // A persisted token exists — re-validate it against the backend.
      store.fetchMe();
    }

    if (redirectToken || authError) {
      url.searchParams.delete('token');
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', url.pathname + url.search);
    }

    setMounted(true);
  }, []);

  if (!mounted) return <Loading />;
  if (token && !me) return <Loading />; // token present, profile loading
  if (!me) return <Login />;
  return <Shell>{children}</Shell>;
}
