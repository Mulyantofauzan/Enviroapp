import { Hono } from 'hono';
import type { AppEnv } from './types';
import { authRoutes } from './auth/routes';

export const app = new Hono<AppEnv>().basePath('/api');

app.route('/auth', authRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong. Try again.' }, 500);
});

export default app;
