import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeEach } from 'vitest';

beforeEach(async () => {
  await applyD1Migrations(env.DB, (env as any).TEST_MIGRATIONS);
  for (const t of ['evidences','event_completions','event_schedules','event_categories','sessions','coagulant','surface_water','weather','pond_thresholds','settling_ponds','users']) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
});
