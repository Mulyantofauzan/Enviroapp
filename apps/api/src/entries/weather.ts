import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { requireAuth, requireWrite } from '../auth/guard';
import { badDate, isFail, ONLY_IF_NOT_OLDER, readBody, readNumbers, readRecordedAt } from './common';

export const weatherRoutes = new Hono<AppEnv>();
weatherRoutes.use('*', requireAuth);

weatherRoutes.put('/:date', requireWrite, async (c) => {
  const date = c.req.param('date');
  const bad = badDate(c, date);
  if (bad) return bad;
  const body = await readBody(c);
  const at = readRecordedAt(c, body);
  if (isFail(at)) return at.fail;
  const v = readNumbers(c, body,
    { rainfall_mm: { min: 0 }, rain_hours: { min: 0, max: 24 } },
    { rainfall_mm: 'Curah hujan', rain_hours: 'Jam hujan' });
  if (isFail(v)) return v.fail;
  const res = await c.env.DB.prepare(
    `INSERT INTO weather (id,date,rainfall_mm,rain_hours,logged_by,client_ts) VALUES (?,?,?,?,?,?)
     ON CONFLICT(date) DO UPDATE SET rainfall_mm = excluded.rainfall_mm, rain_hours = excluded.rain_hours, logged_by = excluded.logged_by, client_ts = excluded.client_ts
     ${at.explicit ? ONLY_IF_NOT_OLDER : ''}`,
  ).bind(crypto.randomUUID(), date, v.rainfall_mm, v.rain_hours, c.get('user').id, at.iso).run();
  return c.json({ date, ...v, applied: res.meta.changes > 0 });
});
