'use client';

import { useAuthStore } from '../lib/store';
import { ui } from '../lib/ui';

// Slack "Sign in with Slack" — a full-page navigation to the backend, which
// redirects on to Slack's consent screen and back with a token.
const SLACK_LOGIN_URL = '/api/auth/slack/start';

export function Login() {
  const authError = useAuthStore((s) => s.authError);

  return (
    <div className="max-w-sm mx-auto mt-24 text-center">
      <div className="font-bold text-2xl mb-1">Attendance SaaS</div>
      <p className={`${ui.muted} mb-6`}>Sign in with your company Slack workspace.</p>

      <div className={ui.card}>
        <a
          href={SLACK_LOGIN_URL}
          className="flex items-center justify-center gap-3 bg-white text-[#1d1c1d] font-semibold rounded-lg px-4 py-3 hover:opacity-90"
        >
          <SlackMark />
          Sign in with Slack
        </a>
        {authError && <div className={`${ui.error} text-center`}>{authError}</div>}
      </div>

      <p className={`${ui.muted} text-[13px]`}>
        Access is scoped to the company linked to your Slack workspace. If your
        workspace isn&apos;t connected yet, ask your company owner to link it.
      </p>
    </div>
  );
}

function SlackMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 122.8 122.8" aria-hidden="true">
      <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z" fill="#e01e5a" />
      <path d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
      <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z" fill="#36c5f0" />
      <path d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
      <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z" fill="#2eb67d" />
      <path d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
      <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z" fill="#ecb22e" />
      <path d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
    </svg>
  );
}
