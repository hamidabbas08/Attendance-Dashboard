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
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-5',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  get isProd(): boolean {
    return this.env === 'production';
  },
};
