'use client';

import { FormEvent, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Status {
  connected: boolean;
  workspace: { workspaceName: string; slackTeamId: string; connected: boolean } | null;
}

function SlackSettings() {
  const { can } = useAuth();
  const { data, reload } = useFetch<Status>('/api/slack/status');
  const [form, setForm] = useState({ slackTeamId: '', workspaceName: '', accessToken: '' });
  const [error, setError] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/slack/configure', { method: 'POST', body: JSON.stringify(form) });
      setForm({ slackTeamId: '', workspaceName: '', accessToken: '' });
      reload();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <>
      <h2 className={ui.h2}>Slack Integration</h2>
      <div className={ui.card}>
        <p className="mb-2">
          Status:{' '}
          {data?.connected ? (
            <span className="pill pill-present">Connected — {data.workspace?.workspaceName}</span>
          ) : (
            <span className="pill pill-absent">Not connected</span>
          )}
        </p>
        <p className={ui.muted}>
          Each Slack workspace maps to exactly one company. Access tokens are stored
          server-side and never returned to the browser.
        </p>
      </div>

      {can('slack:configure') && (
        <div className={ui.card}>
          <h3 className="font-semibold mb-1">Configure workspace</h3>
          <form onSubmit={save}>
            <label className={ui.label}>Slack Team ID</label>
            <input className={ui.input} value={form.slackTeamId} onChange={(e) => setForm({ ...form, slackTeamId: e.target.value })} required />
            <label className={ui.label}>Workspace name</label>
            <input className={ui.input} value={form.workspaceName} onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} required />
            <label className={ui.label}>Bot access token</label>
            <input
              className={ui.input}
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              required
            />
            <div className="mt-4">
              <button className={ui.btn}>Save</button>
            </div>
            {error && <div className={ui.error}>{error}</div>}
          </form>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.SLACK_VIEW}>
      <SlackSettings />
    </Guard>
  );
}
