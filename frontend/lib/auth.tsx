'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, setToken } from './api';

export interface Me {
  userId: string;
  companyId: string | null;
  roles: string[];
  permissions: string[];
  isPlatformAdmin: boolean;
  employeeId: string | null;
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await api<Me>('/api/auth/me');
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email: string, password: string) {
    const res = await api<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setLoading(true);
    await refresh();
  }

  function logout() {
    setToken(null);
    setMe(null);
  }

  // The permission check mirrors the backend, but is ONLY a UI convenience.
  // The server remains the real authorization boundary.
  function can(permission: string): boolean {
    return me?.permissions.includes(permission) ?? false;
  }

  return (
    <AuthContext.Provider value={{ me, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
