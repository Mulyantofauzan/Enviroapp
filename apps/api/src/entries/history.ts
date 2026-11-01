import { Hono } from 'hono';
import { defaultRemaining, isValidDate } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth } from '../auth/guard';
import { previousRemaining } from './coagulant';
import { withDerivedFlow } from './day';

export const historyRoutes = new Hono<AppEnv>();
historyRoutes.use('*', requireAuth);

const MAX_DAYS = 366;

historyRoutes.get('/', async (c) => {
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  const sp = c.req.query('sp') || null;
  if (!isValidDate(from) || !isValidDate(to) || from > to)
    return c.json({ error: 'Pick a valid date range.' }, 400);
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_DAYS)
    return c.json({ error: 'Pick a range of one year or less.' }, 400);
  const db = c.env.DB;
  const spFilter = sp ? 'AND sp_id = ?' : '';
  const args = (extra: unknown[] = []) => (sp ? [...extra, sp] : extra);

  const weather = (await db.prepare('SELECT date,rainfall_mm,rain_hours FROM weather WHERE date BETWEEN ? AND ?').bind(from, to).all<any>()).results;
  const water = (await db.prepare(`SELECT date,sp_id,ph_inlet,ph_outlet,tss_inlet,tss_outlet,debit_inlet_m3s,debit_outlet_m3s FROM surface_water WHERE date BETWEEN ? AND ? ${spFilter}`)
    .bind(...args([from, to])).all<any>()).results;
  const coag = (await db.prepare(`SELECT date,sp_id,type,stock_in,stock_out,stock_remaining FROM coagulant WHERE date BETWEEN ? AND ? ${spFilter}`)
    .bind(...args([from, to])).all<any>()).results;

  const wByDate = new Map(weather.map((w) => [w.date, w]));
  const keys = new Map<string, { date: string; sp_id: string | null }>();
  const add = (date: string, sp_id: string | null) => keys.set(`${date}|${sp_id}`, { date, sp_id });
  for (const r of [...water, ...coag]) add(r.date, r.sp_id);
  for (const w of weather) {
    const has = [...keys.values()].some((k) => k.date === w.date);
    if (!has) add(w.date, sp);
  }

  const entries = [];
  for (const { date, sp_id } of keys.values()) {
    const cRows = coag.filter((r) => r.date === date && r.sp_id === sp_id);
    const coagulant = [];
    for (const r of cRows) {
      const prev = await previousRemaining(db, r.sp_id, r.type, date);
      const expected = defaultRemaining(prev, r.stock_in ?? 0, r.stock_out ?? 0);
      coagulant.push({ ...r, staleRemaining: Math.abs((r.stock_remaining ?? 0) - expected) > 1e-9 });
    }
    entries.push({
      date, sp_id,
      weather: wByDate.get(date) ?? null,
      water: withDerivedFlow(water.find((r) => r.date === date && r.sp_id === sp_id) ?? null),
      coagulant,
    });
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return c.json(entries);
});
