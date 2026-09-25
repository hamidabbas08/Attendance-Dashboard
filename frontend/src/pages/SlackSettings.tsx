import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { useFetch } from '../useFetch';

interface Status {
  connected: boolean;
  workspace: { workspaceName: string; slackTeamId: string; connected: boolean } | null;
}

export function SlackSettings() {
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
      <h2>Slack Integration</h2>
      <div className="card">
        <p>
          Status:{' '}
          {data?.connected ? (
            <span className="pill present">Connected — {data.workspace?.workspaceName}</span>
          ) : (
            <span className="pill absent">Not connected</span>
          )}
        </p>
        <p className="muted">
          Each Slack workspace maps to exactly one company. Access tokens are stored
          server-side and never returned to the browser.
        </p>
      </div>

      {can('slack:configure') && (
        <div className="card">
          <h3>Configure workspace</h3>
          <form onSubmit={save}>
            <label>Slack Team ID</label>
            <input value={form.slackTeamId} onChange={(e) => setForm({ ...form, slackTeamId: e.target.value })} required />
            <label>Workspace name</label>
            <input value={form.workspaceName} onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} required />
            <label>Bot access token</label>
            <input
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              required
            />
            <div style={{ marginTop: 16 }}>
              <button>Save</button>
            </div>
            {error && <div className="error">{error}</div>}
          </form>
        </div>
      )}
    </>
  );
}
