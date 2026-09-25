'use client';

import { useAuthStore } from './store';

export type { Me } from './store';

/**
 * Thin convenience hook over the persisted Zustand auth store, so page/components
 * keep a stable `useAuth()` API. `can()` is a UI convenience only — the backend
 * remains the real authorization boundary.
 */
export function useAuth() {
  const me = useAuthStore((s) => s.me);
  const loading = useAuthStore((s) => s.loading);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const can = useAuthStore((s) => s.can);
  return { me, loading, login, logout, can };
}
