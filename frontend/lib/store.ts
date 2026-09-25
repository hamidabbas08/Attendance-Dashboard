'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api } from './api';

export interface Me {
  userId: string;
  companyId: string | null;
  roles: string[];
  permissions: string[];
  isPlatformAdmin: boolean;
  employeeId: string | null;
}

interface AuthState {
  token: string | null;
  me: Me | null;
  loading: boolean; // true while /auth/me is in flight
  hydrated: boolean; // true once persisted state has been read from storage
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  can: (permission: string) => boolean;
}

// No-op storage for SSR, where localStorage does not exist.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/**
 * Global auth store. `token` and `me` are persisted to localStorage via the
 * persist middleware, so a signed-in session survives a full page reload.
 * The permission list is derived server-side and only mirrored here for the UI.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      me: null,
      loading: false,
      hydrated: false,

      async login(email, password) {
        const res = await api<{ token: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        set({ token: res.token });
        await get().fetchMe();
      },

      logout() {
        set({ token: null, me: null });
      },

      async fetchMe() {
        if (!get().token) {
          set({ me: null });
          return;
        }
        set({ loading: true });
        try {
          const me = await api<Me>('/api/auth/me');
          set({ me });
        } catch {
          // Token is invalid/expired — clear it.
          set({ me: null, token: null });
        } finally {
          set({ loading: false });
        }
      },

      can(permission) {
        return get().me?.permissions.includes(permission) ?? false;
      },
    }),
    {
      name: 'attendance-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : noopStorage,
      ),
      // Only persist identity; never persist transient flags.
      partialize: (s) => ({ token: s.token, me: s.me }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);
