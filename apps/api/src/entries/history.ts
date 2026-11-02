import { Hono } from 'hono';
import { defaultRemaining, isValidDate } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth } from '../auth/guard';
import { withDerivedFlow } from './day';

export const historyRoutes = new Hono<AppEnv>();
historyRoutes.use('*', requireAuth);

const MAX_DAYS = 366;

historyRoutes.get('/', async (c) => {
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  const sp = c.req.query('sp') || null;
  if (!isValidDate(from) || !isValidDate(to) || from > to)
    return c.json({ error: 'Pilih rentang tanggal yang benar.' }, 400);
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_DAYS)
    return c.json({ error: 'Pilih rentang satu tahun atau kurang.' }, 400);
  const db = c.env.DB;
  const spFilter = sp ? 'AND sp_id = ?' : '';
  const args = (extra: unknown[] = []) => (sp ? [...extra, sp] : extra);

  const weather = (await db.prepare('SELECT date,rainfall_mm,rain_hours FROM weather WHERE date BETWEEN ? AND ?').bind(from, to).all<any>()).results;
  const water = (await db.prepare(`SELECT date,sp_id,ph_inlet,ph_outlet,tss_inlet,tss_outlet,debit_inlet_m3s,debit_outlet_m3s FROM surface_water WHERE date BETWEEN ? AND ? ${spFilter}`)
    .bind(...args([from, to])).all<any>()).results;
  // Include rows before `from`: the latest earlier row is the "previous" for the first day in range.
  const coagAll = (await db.prepare(`SELECT date,sp_id,type,stock_in,stock_out,stock_remaining FROM coagulant WHERE date <= ? ${spFilter} ORDER BY sp_id, type, date`)
    .bind(...args([to])).all<any>()).results;
  const coag: any[] = [];
  let group = '';
  let prev: number | null = null;
  for (const r of coagAll) {
    const g = `${r.sp_id}|${r.type}`;
    if (g !== group) { group = g; prev = null; }
    if (r.date >= from) {
      const expected = defaultRemaining(prev, r.stock_in ?? 0, r.stock_out ?? 0);
      coag.push({ ...r, staleRemaining: Math.abs((r.stock_remaining ?? 0) - expected) > 1e-9 });
    }
    prev = r.stock_remaining ?? null;
  }

  const wByDate = new Map(weather.map((w) => [w.date, w]));
  const keys = new Map<string, { date: string; sp_id: string | null }>();
  const datesSeen = new Set<string>();
  const add = (date: string, sp_id: string | null) => { keys.set(`${date}|${sp_id}`, { date, sp_id }); datesSeen.add(date); };
  for (const r of [...water, ...coag]) add(r.date, r.sp_id);
  for (const w of weather) if (!datesSeen.has(w.date)) add(w.date, sp);

  // Indexed once: a year across many ponds would otherwise rescan these arrays for every entry.
  const waterByKey = new Map<string, any>();
  for (const r of water) { const k = `${r.date}|${r.sp_id}`; if (!waterByKey.has(k)) waterByKey.set(k, r); }
  const coagByKey = new Map<string, any[]>();
  for (const r of coag) { const k = `${r.date}|${r.sp_id}`; (coagByKey.get(k) ?? coagByKey.set(k, []).get(k)!).push(r); }

  const entries = [];
  for (const { date, sp_id } of keys.values()) {
    const k = `${date}|${sp_id}`;
    entries.push({
      date, sp_id,
      weather: wByDate.get(date) ?? null,
      water: withDerivedFlow(waterByKey.get(k) ?? null),
      coagulant: coagByKey.get(k) ?? [],
    });
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return c.json(entries);
});

const COAG_TYPES = ['Tawas Serbuk', 'Tawas Batu', 'Kapur'] as const;

historyRoutes.get('/coagulant-total', async (c) => {
  const to = c.req.query('to') ?? '';
  const sp = c.req.query('sp') || null;
  if (!isValidDate(to) || (Date.parse(to) - Date.now()) / 86_400_000 > MAX_DAYS)
    return c.json({ error: 'Tanggal akhir tidak sah.' }, 400);
  const rows = (await c.env.DB
    .prepare(`SELECT sp_id, type, SUM(COALESCE(stock_out, 0)) AS total, MIN(date) AS first_date FROM coagulant WHERE date <= ? ${sp ? 'AND sp_id = ?' : ''} GROUP BY sp_id, type`)
    .bind(...(sp ? [to, sp] : [to])).all<{ sp_id: string; type: string; total: number; first_date: string }>()).results;
  const ponds = new Map<string, { sp_id: string; first_date: string | null; 'Tawas Serbuk': number; 'Tawas Batu': number; Kapur: number }>();
  for (const r of rows) {
    const p = ponds.get(r.sp_id) ?? { sp_id: r.sp_id, first_date: null, 'Tawas Serbuk': 0, 'Tawas Batu': 0, Kapur: 0 };
    if (!p.first_date || r.first_date < p.first_date) p.first_date = r.first_date;
    if ((COAG_TYPES as readonly string[]).includes(r.type)) p[r.type as (typeof COAG_TYPES)[number]] = r.total;
    ponds.set(r.sp_id, p);
  }
  return c.json({ ponds: [...ponds.values()] });
});
