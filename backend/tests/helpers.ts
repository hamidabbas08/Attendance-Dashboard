import { createHmac } from 'crypto';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { config } from '../src/config/env';
import { seedDatabase, SeedResult } from '../src/data/seed';
import { store } from '../src/data/store';

export interface TestCtx {
  app: Express;
  seed: SeedResult;
}

export async function setup(): Promise<TestCtx> {
  const seed = await seedDatabase(store);
  const app = createApp();
  return { app, seed };
}

export async function login(app: Express, email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Build a validly-signed Slack event request. */
export function slackSigned(body: unknown) {
  const raw = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig =
    'v0=' +
    createHmac('sha256', config.slackSigningSecret).update(`v0:${ts}:${raw}`).digest('hex');
  return { raw, ts, sig };
}
