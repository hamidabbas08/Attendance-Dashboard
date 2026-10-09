'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Button } from '../ui';

// Pulls the latest #attendance check-ins from Slack on demand (bot-token poll),
// then reloads the grid. Complements the automatic 60s background poller.
export function PullButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function pull() {
    setBusy(true);
    setMsg('');
    try {
      const r = await api<{ recorded: number; scanned: number }>('/api/slack/poll', { method: 'POST' });
      setMsg(`Recorded ${r.recorded} of ${r.scanned} message${r.scanned === 1 ? '' : 's'}.`);
      onDone();
    } catch (err) {
      setMsg((err as ApiError).message);
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 6000);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="ghost" onClick={pull} disabled={busy}>
        {busy ? 'Pulling…' : 'Pull check-ins'}
      </Button>
      {msg && <span className="text-[11px] text-muted whitespace-nowrap">{msg}</span>}
    </div>
  );
}
