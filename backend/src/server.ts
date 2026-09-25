import { createApp } from './app';
import { config } from './config/env';
import { seedDatabase } from './data/seed';
import { store } from './data/store';

async function main(): Promise<void> {
  // In the memory adapter, seed demo tenants so the API is usable immediately.
  if (config.dataAdapter === 'memory') {
    const seed = await seedDatabase(store);
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
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
