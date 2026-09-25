'use client';

import { FormEvent, useState } from 'react';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

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
    <div className="login">
      <div className="brand">Attendance SaaS</div>
      <div className="card">
        <form onSubmit={onSubmit}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div style={{ marginTop: 18 }}>
            <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
          {error && <div className="error">{error}</div>}
        </form>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Demo logins (password <code>Password123!</code>): owner@acme.test, hr@acme.test,
        employee@acme.test, admin@platform.test
      </p>
    </div>
  );
}
