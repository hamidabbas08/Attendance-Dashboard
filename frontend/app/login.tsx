'use client';

import { FormEvent, useState } from 'react';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ui } from '../lib/ui';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('owner@acme.test');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as ApiError).message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-20">
      <div className="font-bold text-lg px-3 pb-5">Attendance SaaS</div>
      <div className={ui.card}>
        <form onSubmit={onSubmit}>
          <label className={ui.label}>Email</label>
          <input className={ui.input} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <label className={ui.label}>Password</label>
          <input
            className={ui.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-4">
            <button className={ui.btn} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
          {error && <div className={ui.error}>{error}</div>}
        </form>
      </div>
      <p className="text-muted text-[13px]">
        Demo logins (password <code>Password123!</code>): owner@acme.test, hr@acme.test,
        employee@acme.test, admin@platform.test
      </p>
    </div>
  );
}
