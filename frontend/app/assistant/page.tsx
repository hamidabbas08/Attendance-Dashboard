'use client';

import { FormEvent, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';

interface Answer {
  answer: string;
  scope: 'own' | 'company';
  recordCount: number;
}

function ClaudeAssistant() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(e: FormEvent) {
    e.preventDefault();
    setError('');
    setAnswer(null);
    setBusy(true);
    try {
      const res = await api<Answer>('/api/claude/query', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
      setAnswer(res);
    } catch (err) {
      const e2 = err as ApiError;
      setError(
        e2.status === 403
          ? 'You can only ask about your own attendance — company-wide questions require elevated permission.'
          : e2.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className={ui.h2}>AI Attendance Assistant</h2>
      <div className={ui.card}>
        <p className={`${ui.muted} mb-2`}>
          Ask natural-language questions. The backend resolves your company, checks your
          permissions, and only sends the data you are allowed to see to Claude.
        </p>
        <form onSubmit={ask}>
          <input
            className={ui.input}
            placeholder="e.g. How many times was I late this month?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
          />
          <div className="mt-3">
            <button className={ui.btn} disabled={busy}>
              {busy ? 'Thinking…' : 'Ask'}
            </button>
          </div>
        </form>
        {error && <div className={ui.error}>{error}</div>}
        {answer && (
          <div className={`${ui.card} mt-4`}>
            <p>{answer.answer}</p>
            <p className={ui.muted}>
              scope: {answer.scope} · records considered: {answer.recordCount}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.CLAUDE_QUERY_OWN}>
      <ClaudeAssistant />
    </Guard>
  );
}
