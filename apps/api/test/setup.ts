import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeEach } from 'vitest';

beforeEach(async () => {
  await applyD1Migrations(env.DB, (env as any).TEST_MIGRATIONS);
  for (const t of ['sessions','coagulant','surface_water','weather','pond_thresholds','settling_ponds','users']) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
});
