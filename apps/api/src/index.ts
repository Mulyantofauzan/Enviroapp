import { Hono } from 'hono';
import type { AppEnv } from './types';
import { authRoutes } from './auth/routes';
import { pondRoutes } from './admin/ponds';
import { userRoutes } from './admin/users';
import { weatherRoutes } from './entries/weather';
import { waterRoutes } from './entries/water';
import { coagulantRoutes } from './entries/coagulant';
import { dayRoutes } from './entries/day';
import { historyRoutes } from './entries/history';
import { dashboardRoutes } from './entries/dashboard';
import { entryImportRoutes } from './entries/import';
import { scheduleRoutes } from './events/schedules';
import { eventRoutes } from './events/events';
import { categoryRoutes } from './events/categories';
import { evidenceRoutes } from './events/evidence';
import { pushRoutes } from './push/routes';
import { runEventReminders, runMonitoringReminder } from './push/jobs';
import { nightlyBackup } from './backup';
import type { Env } from './types';

export const app = new Hono<AppEnv>().basePath('/api');

app.route('/auth', authRoutes);
app.route('/ponds', pondRoutes);
app.route('/users', userRoutes);
app.route('/weather', weatherRoutes);
app.route('/water', waterRoutes);
app.route('/coagulant', coagulantRoutes);
app.route('/day', dayRoutes);
app.route('/history', historyRoutes);
app.route('/dashboard', dashboardRoutes);
app.route('/entries', entryImportRoutes);
app.route('/schedules', scheduleRoutes);
app.route('/event-categories', categoryRoutes);
app.route('/events', eventRoutes);
app.route('/push', pushRoutes);
app.route('/', evidenceRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Terjadi kesalahan. Coba lagi.' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // WITA is UTC+8: 23:00 UTC = 07:00, 08:00 UTC = 16:00.
    if (event.cron === '0 23 * * *') ctx.waitUntil(runEventReminders(env, 'morning'));
    else if (event.cron === '0 8 * * *') ctx.waitUntil(Promise.all([runMonitoringReminder(env), runEventReminders(env, 'afternoon')]));
    else ctx.waitUntil(nightlyBackup(env));
  },
};
