import { createApp } from './app';
import { config } from './config/env';
import { seedDatabase } from './data/seed';
import { store } from './data/store';

async function main(): Promise<void> {
  // In the memory adapter, seed demo tenants so the API is usable immediately.
  if (config.dataAdapter === 'memory') {
    const seed = await seedDatabase(store);
    // Preview the imported spreadsheet attendance under the demo company too.
    if (config.importAttendance) {
      const { importAttendanceInto } = await import('./data/importSeed');
      const res = importAttendanceInto(seed.companyA.companyId, { force: true });
      // eslint-disable-next-line no-console
      console.log(`Imported ${res.records} attendance records for ${res.employees} employees.`);
    }
    // eslint-disable-next-line no-console
    console.log(
      `Seeded demo data. Login with e.g. owner@acme.test / ${seed.password} (company A) ` +
        `or admin@platform.test / ${seed.password} (platform admin).`,
    );
  }

  const app = createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${config.port} [${config.env}]`);
  });

  // Live attendance: poll the #attendance channel on an interval (works even
  // without Slack Event Subscriptions, using the bot token).
  if (config.slackBotToken && config.slackPollSeconds > 0) {
    const { pollAllWorkspaces } = await import('./slack/poller');
    const tick = () =>
      pollAllWorkspaces().catch((e) => console.error('Slack poll error:', (e as Error).message));
    setTimeout(tick, 5000); // shortly after boot
    setInterval(tick, config.slackPollSeconds * 1000);
    // eslint-disable-next-line no-console
    console.log(`Slack attendance polling every ${config.slackPollSeconds}s.`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
