import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api';

interface Answer {
  answer: string;
  scope: 'own' | 'company';
  recordCount: number;
}

export function ClaudeAssistant() {
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
      <h2>AI Attendance Assistant</h2>
      <div className="card">
        <p className="muted">
          Ask natural-language questions. The backend resolves your company, checks your
          permissions, and only sends the data you are allowed to see to Claude.
        </p>
        <form onSubmit={ask}>
          <input
            placeholder="e.g. How many times was I late this month?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
          />
          <div style={{ marginTop: 12 }}>
            <button disabled={busy}>{busy ? 'Thinking…' : 'Ask'}</button>
          </div>
        </form>
        {error && <div className="error">{error}</div>}
        {answer && (
          <div className="card" style={{ marginTop: 16 }}>
            <p>{answer.answer}</p>
            <p className="muted">
              scope: {answer.scope} · records considered: {answer.recordCount}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
