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
  // Load the bundled spreadsheet attendance dataset into a company on provision
  // (in-memory adapter preview). Default on; set IMPORT_ATTENDANCE=false to skip.
  importAttendance: (process.env.IMPORT_ATTENDANCE ?? 'true').toLowerCase() !== 'false',
  // When true (default), the first Slack login from an unlinked workspace
  // creates a company + owner; later members auto-join as employees. Set
  // SLACK_AUTO_PROVISION=false to require workspaces to be linked manually.
  slackAutoProvision: (process.env.SLACK_AUTO_PROVISION ?? 'true').toLowerCase() !== 'false',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-5',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  get isProd(): boolean {
    return this.env === 'production';
  },
};
