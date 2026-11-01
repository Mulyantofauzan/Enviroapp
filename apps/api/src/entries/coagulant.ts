import { Hono } from 'hono';
import { COAGULANT_TYPES, defaultRemaining, type CoagulantType } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth, requireWrite } from '../auth/guard';
import { activePond, badDate, isFail, readBody, readNumbers } from './common';

export const coagulantRoutes = new Hono<AppEnv>();
coagulantRoutes.use('*', requireAuth);

export async function previousRemaining(db: D1Database, sp: string, type: string, date: string): Promise<number | null> {
  const r = await db
    .prepare('SELECT stock_remaining FROM coagulant WHERE sp_id = ? AND type = ? AND date < ? ORDER BY date DESC LIMIT 1')
    .bind(sp, type, date).first<{ stock_remaining: number | null }>();
  return r?.stock_remaining ?? null;
}

coagulantRoutes.put('/:date/:sp/:type', requireWrite, async (c) => {
  const date = c.req.param('date');
  const sp = c.req.param('sp');
  const type = c.req.param('type');
  const bad = badDate(c, date);
  if (bad) return bad;
  if (!(COAGULANT_TYPES as string[]).includes(type)) return c.json({ error: 'Pick Tawas Serbuk, Tawas Batu or Kapur.' }, 400);
  const pond = await activePond(c, sp);
  if (pond) return pond;
  const v = readNumbers(c, await readBody(c),
    { stock_in: { min: 0 }, stock_out: { min: 0 }, stock_remaining: {} },
    { stock_in: 'Stock in', stock_out: 'Stock out', stock_remaining: 'Stock remaining' });
  if (isFail(v)) return v.fail;
  const prev = await previousRemaining(c.env.DB, sp, type, date);
  const remaining = v.stock_remaining ?? defaultRemaining(prev, v.stock_in ?? 0, v.stock_out ?? 0);
  await c.env.DB.prepare(
    `INSERT INTO coagulant (id,date,sp_id,type,stock_in,stock_out,stock_remaining,logged_by) VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(date,sp_id,type) DO UPDATE SET stock_in=excluded.stock_in, stock_out=excluded.stock_out,
       stock_remaining=excluded.stock_remaining, logged_by=excluded.logged_by`,
  ).bind(crypto.randomUUID(), date, sp, type, v.stock_in, v.stock_out, remaining, c.get('user').id).run();
  return c.json({ date, sp_id: sp, type: type as CoagulantType, stock_in: v.stock_in, stock_out: v.stock_out, stock_remaining: remaining });
});
