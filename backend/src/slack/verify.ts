import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config/env';

const FIVE_MINUTES = 60 * 5;

/**
 * Verify an inbound Slack request signature.
 * See https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * @param rawBody the EXACT raw request body bytes (not the parsed JSON)
 */
export function verifySlackSignature(params: {
  signature: string | undefined;
  timestamp: string | undefined;
  rawBody: string;
  now?: number;
}): boolean {
  const { signature, timestamp, rawBody } = params;
  if (!signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  // Anti-replay: reject requests older than 5 minutes.
  const nowSec = Math.floor((params.now ?? Date.now()) / 1000);
  if (Math.abs(nowSec - ts) > FIVE_MINUTES) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const expected =
    'v0=' + createHmac('sha256', config.slackSigningSecret).update(base).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
