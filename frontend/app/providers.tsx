'use client';

import { ReactNode, useEffect } from 'react';
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
 * Gate: captures a token (or error) handed back by the Slack OAuth redirect,
 * waits for the persisted store to hydrate, re-validates the token, then shows
 * the login screen or the app shell.
 */
export function Providers({ children }: { children: ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.me);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  // Capture ?token / ?auth_error from the Slack redirect, then clean the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    const redirectToken = url.searchParams.get('token');
    const authError = url.searchParams.get('auth_error');
    if (redirectToken) {
      useAuthStore.getState().setSession(redirectToken);
    } else if (authError) {
      useAuthStore.getState().setAuthError(AUTH_ERRORS[authError] ?? 'Sign-in failed.');
    }
    if (redirectToken || authError) {
      url.searchParams.delete('token');
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);

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
