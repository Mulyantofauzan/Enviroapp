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
import { scheduleRoutes } from './events/schedules';

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
app.route('/schedules', scheduleRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Terjadi kesalahan. Coba lagi.' }, 500);
});

export default app;
