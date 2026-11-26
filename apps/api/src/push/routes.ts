import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { requireAuth } from '../auth/guard';

export const pushRoutes = new Hono<AppEnv>();
pushRoutes.use('*', requireAuth);

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 2048;

pushRoutes.get('/key', (c) => {
  const key = c.env.VAPID_PUBLIC_KEY;
  if (!key) return c.json({ error: 'Notifikasi belum diaktifkan di server.' }, 503);
  return c.json({ key });
});

pushRoutes.post('/subscribe', async (c) => {
  const b = await c.req.json().catch(() => null) as any;
  if (!isStr(b?.endpoint) || !b.endpoint.startsWith('https://') || !isStr(b?.keys?.p256dh) || !isStr(b?.keys?.auth)) {
    return c.json({ error: 'Data langganan tidak valid.' }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth,created_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
  ).bind(crypto.randomUUID(), c.get('user').id, b.endpoint, b.keys.p256dh, b.keys.auth, new Date().toISOString()).run();
  return c.json({ ok: true });
});

pushRoutes.delete('/subscribe', async (c) => {
  const b = await c.req.json().catch(() => null) as any;
  if (!isStr(b?.endpoint)) return c.json({ error: 'Data langganan tidak valid.' }, 400);
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(b.endpoint, c.get('user').id).run();
  return c.json({ ok: true });
});
