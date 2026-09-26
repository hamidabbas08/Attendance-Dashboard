'use client';

import { FormEvent, useEffect, useState } from 'react';
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
  const status = useFetch<Status>('/api/slack/status');
  const [form, setForm] = useState({ slackTeamId: '', workspaceName: '', accessToken: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Prefill the form from the saved workspace so values don't "disappear".
  useEffect(() => {
    const ws = status.data?.workspace;
    if (ws) {
      setForm((f) => ({
        slackTeamId: f.slackTeamId || ws.slackTeamId || '',
        workspaceName: f.workspaceName || ws.workspaceName || '',
        accessToken: f.accessToken,
      }));
    }
  }, [status.data]);

  const connected = status.data?.connected;
  const hasToken = status.data?.workspace?.connected;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await api('/api/slack/configure', { method: 'POST', body: JSON.stringify(form) });
      setMsg('Saved.');
      setForm((f) => ({ ...f, accessToken: '' })); // don't keep the secret in state
      status.reload();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function sync() {
    setSyncing(true);
    setError('');
    setMsg('');
    try {
      const res = await api<{ imported: number; updated: number; total: number }>(
        '/api/slack/sync-members',
        { method: 'POST' },
      );
      setMsg(`Synced ${res.total} members — ${res.imported} added, ${res.updated} updated. See Team.`);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <h2 className={ui.h2}>Slack Integration</h2>

      <div className={ui.card}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="m-0">
            Status:{' '}
            {connected ? (
              <span className="pill pill-present">
                Connected — {status.data?.workspace?.workspaceName} ({status.data?.workspace?.slackTeamId})
              </span>
            ) : (
              <span className="pill pill-absent">Not connected</span>
            )}
            {connected && !hasToken && (
              <span className="pill pill-late ml-2">Bot token missing</span>
            )}
          </p>
          {can('employees:create') && (
            <button className={ui.btn} onClick={sync} disabled={syncing || !hasToken}>
              {syncing ? 'Syncing…' : 'Sync members from Slack'}
            </button>
          )}
        </div>
        <p className={`${ui.muted} text-[13px] mt-2 mb-0`}>
          Each Slack workspace maps to exactly one company. The bot token is stored server-side and
          never shown again. {!hasToken && 'Add your bot token below, Save, then Sync.'}
        </p>
        {msg && <div className="text-emerald-300 text-sm mt-2">{msg}</div>}
        {error && <div className={ui.error}>{error}</div>}
      </div>

      {can('slack:configure') && (
        <div className={ui.card}>
          <h3 className="font-semibold mb-1">Configure workspace</h3>
          <form onSubmit={save}>
            <label className={ui.label}>Slack Team ID</label>
            <input className={ui.input} value={form.slackTeamId} onChange={(e) => setForm({ ...form, slackTeamId: e.target.value })} placeholder="T0XXXXXXX" required />
            <label className={ui.label}>Workspace name</label>
            <input className={ui.input} value={form.workspaceName} onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} placeholder="Stellar Stack" required />
            <label className={ui.label}>
              Bot access token {hasToken && <span className="text-emerald-300">(a token is already saved — leave blank to keep it)</span>}
            </label>
            <input
              className={ui.input}
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              placeholder={hasToken ? '•••••••• (unchanged)' : 'xoxb-…'}
              required={!hasToken}
            />
            <div className="mt-4">
              <button className={ui.btn}>Save</button>
            </div>
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
