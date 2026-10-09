/** Centralized, validated environment configuration. */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET', 'dev-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  dataAdapter: (process.env.DATA_ADAPTER ?? 'memory') as 'memory' | 'prisma',
  // Optional Postgres connection. When set, the in-memory store is snapshotted
  // to Postgres and restored on boot, so every change (shifts, roles, holidays,
  // attendance, Slack links) survives redeploys. Unset = pure in-memory.
  databaseUrl: process.env.DATABASE_URL ?? '',
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET ?? 'dev-slack-secret',
  // Slack "Sign in with Slack" (OpenID Connect) credentials.
  slackClientId: process.env.SLACK_CLIENT_ID ?? '',
  slackClientSecret: process.env.SLACK_CLIENT_SECRET ?? '',
  slackOauthRedirectUrl:
    process.env.SLACK_OAUTH_REDIRECT_URL ?? 'http://localhost:4000/api/auth/slack/callback',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  // Env-driven Slack workspace config (single-company deployments): the bot
  // token + workspace details are read from env instead of the UI. Optional.
  slackBotToken: process.env.SLACK_BOT_TOKEN ?? '',
  slackTeamId: process.env.SLACK_TEAM_ID ?? '',
  slackWorkspaceName: process.env.SLACK_WORKSPACE_NAME ?? '',
  // Poll the #attendance channel for check-ins (works without Event Subscriptions).
  slackAttendanceChannel: process.env.SLACK_ATTENDANCE_CHANNEL ?? '',
  slackPollSeconds: Number(process.env.SLACK_POLL_SECONDS ?? 60),
  // Timezone offset (minutes from UTC) used to record Slack check-in/out times
  // and dates in local time. Default +300 = PKT (UTC+5).
  attendanceTzOffsetMinutes: Number(process.env.ATTENDANCE_TZ_OFFSET_MINUTES ?? 300),
  // Load the bundled spreadsheet attendance dataset into a company on provision
  // (in-memory adapter preview). Default on; set IMPORT_ATTENDANCE=false to skip.
  importAttendance: (process.env.IMPORT_ATTENDANCE ?? 'true').toLowerCase() !== 'false',
  // When true (default), the first Slack login from an unlinked workspace
  // creates a company + owner; later members auto-join as employees. Set
  // SLACK_AUTO_PROVISION=false to require workspaces to be linked manually.
  slackAutoProvision: (process.env.SLACK_AUTO_PROVISION ?? 'true').toLowerCase() !== 'false',
  // scrin.io (formerly ScreenshotMonitor) — per-employee time/activity/screenshot
  // data, shown on the employee detail page's "Screen Activity" tab. Optional;
  // the tab shows a "not connected" state when unset. This must be an
  // OWNER-level token (My Account → scrin.io API v2 → X-SSM-Token) — an
  // employee-level token only sees that one person's own data.
  scrinApiKey: process.env.SCRIN_IO_API_KEY ?? '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-5',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  get isProd(): boolean {
    return this.env === 'production';
  },
};
