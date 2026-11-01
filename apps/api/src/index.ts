import { Hono } from 'hono';
import type { AppEnv } from './types';
import { authRoutes } from './auth/routes';
import { pondRoutes } from './admin/ponds';
import { thresholdRoutes } from './admin/thresholds';
import { userRoutes } from './admin/users';

export const app = new Hono<AppEnv>().basePath('/api');

app.route('/auth', authRoutes);
app.route('/ponds', pondRoutes);
app.route('/thresholds', thresholdRoutes);
app.route('/users', userRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong. Try again.' }, 500);
});

export default app;
