import { Hono } from 'hono';
import type { AppEnv } from './types';
import { authRoutes } from './auth/routes';
import { pondRoutes } from './admin/ponds';
import { thresholdRoutes } from './admin/thresholds';
import { userRoutes } from './admin/users';
import { weatherRoutes } from './entries/weather';
import { waterRoutes } from './entries/water';
import { coagulantRoutes } from './entries/coagulant';
import { dayRoutes } from './entries/day';
import { historyRoutes } from './entries/history';

export const app = new Hono<AppEnv>().basePath('/api');

app.route('/auth', authRoutes);
app.route('/ponds', pondRoutes);
app.route('/thresholds', thresholdRoutes);
app.route('/users', userRoutes);
app.route('/weather', weatherRoutes);
app.route('/water', waterRoutes);
app.route('/coagulant', coagulantRoutes);
app.route('/day', dayRoutes);
app.route('/history', historyRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong. Try again.' }, 500);
});

export default app;
