'use client';

import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../lib/auth';
import { Login } from './login';
import { Shell } from './shell';

/** Gate: unauthenticated users see the login screen; everyone else the app shell. */
function Gate({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <div className="login">Loading…</div>;
  if (!me) return <Login />;
  return <Shell>{children}</Shell>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}
