import cors from 'cors';
import express, { Express, Request } from 'express';
import helmet from 'helmet';
import { config } from './config/env';
import { authenticate } from './middleware/authenticate';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { attendanceRouter } from './modules/attendance.routes';
import { attendanceRulesRouter } from './modules/attendanceRules.routes';
import { auditRouter } from './modules/audit.routes';
import { authRouter } from './modules/auth.routes';
import { claudeRouter } from './modules/claude.routes';
import { companiesRouter } from './modules/companies.routes';
import { employeesRouter } from './modules/employees.routes';
import { reportsRouter } from './modules/reports.routes';
import { shiftsRouter } from './modules/shifts.routes';
import { slackRouter, slackWebhookRouter } from './modules/slack.routes';
import { usersRouter } from './modules/users.routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));

  // Capture the raw body so the Slack webhook can verify request signatures.
  app.use(
    express.json({
      verify: (req: Request, _res, buf) => {
        (req as unknown as { rawBody: string }).rawBody = buf.toString('utf8');
      },
    }),
  );

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Public, Slack-signed webhook. MUST be mounted before the authenticated
  // slack router so /events is reachable without a user token.
  app.use('/api/slack', slackWebhookRouter);

  // Public auth routes.
  app.use('/api/auth', authRouter);

  // Everything below requires a valid bearer token (401 gate).
  app.use('/api/companies', authenticate, companiesRouter);
  app.use('/api/users', authenticate, usersRouter);
  app.use('/api/employees', authenticate, employeesRouter);
  app.use('/api/shifts', authenticate, shiftsRouter);
  app.use('/api/attendance-rules', authenticate, attendanceRulesRouter);
  app.use('/api/attendance', authenticate, attendanceRouter);
  app.use('/api/reports', authenticate, reportsRouter);
  app.use('/api/slack', authenticate, slackRouter);
  app.use('/api/claude', authenticate, claudeRouter);
  app.use('/api/audit', authenticate, auditRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
