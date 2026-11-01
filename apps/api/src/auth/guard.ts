import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { canWrite, isAdmin } from '@evo/shared';
import type { AppEnv } from '../types';
import { getSessionUser } from './session';

export const COOKIE = 'evo_session';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const sid = getCookie(c, COOKIE);
  const user = sid ? await getSessionUser(c.env.DB, sid) : null;
  if (!user) return c.json({ error: 'Please sign in.' }, 401);
  c.set('user', user);
  await next();
});

export const requireWrite = createMiddleware<AppEnv>(async (c, next) => {
  if (!canWrite(c.get('user').role)) return c.json({ error: 'Your role cannot change data.' }, 403);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!isAdmin(c.get('user').role)) return c.json({ error: 'Admin only.' }, 403);
  await next();
});
