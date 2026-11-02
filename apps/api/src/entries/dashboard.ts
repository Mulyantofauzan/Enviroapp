import { Hono } from 'hono';
import { COAGULANT_TYPES, isValidDate, m3sToM3d, type Threshold } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth } from '../auth/guard';

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use('*', requireAuth);

const DAY_MS = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

dashboardRoutes.get('/', async (c) => {
  const sp = c.req.query('sp') ?? '';
  const days = Number(c.req.query('days'));
  const date = c.req.query('date') ?? new Date().toISOString().slice(0, 10);
  if (![7, 30, 90].includes(days)) return c.json({ error: 'Pilih rentang 7, 30, atau 90 hari.' }, 400);
  if (!isValidDate(date)) return c.json({ error: 'Tanggal harus berbentuk 2026-11-02.' }, 400);
  const db = c.env.DB;
  const pond = await db.prepare('SELECT id FROM settling_ponds WHERE id = ?').bind(sp).first();
  if (!pond) return c.json({ error: 'Pond tidak ditemukan.' }, 404);

  const start = addDays(date, -(days - 1));
  const water = (await db.prepare(
    'SELECT date,ph_inlet,ph_outlet,tss_inlet,tss_outlet,debit_outlet_m3s FROM surface_water WHERE sp_id = ? AND date BETWEEN ? AND ?',
  ).bind(sp, start, date).all<any>()).results;
  const weatherRows = (await db.prepare('SELECT date,rainfall_mm,rain_hours FROM weather WHERE date BETWEEN ? AND ?').bind(start, date).all<any>()).results;
  const weatherByDate = new Map(weatherRows.map((w) => [w.date, w]));
  const weather = weatherByDate.get(date);
  const coag = (await db.prepare(
    'SELECT date,type,stock_remaining FROM coagulant WHERE sp_id = ? AND date <= ? ORDER BY type, date',
  ).bind(sp, date).all<any>()).results;
  const th = (await db.prepare('SELECT key,min,max FROM pond_thresholds WHERE sp_id = ?').bind(sp).all<any>()).results;

  const byDate = new Map(water.map((w) => [w.date, w]));
  const series = Array.from({ length: days }, (_, i) => {
    const d = addDays(start, i);
    const w = byDate.get(d);
    return {
      date: d, ph_inlet: w?.ph_inlet ?? null, ph_outlet: w?.ph_outlet ?? null,
      tss_inlet: w?.tss_inlet ?? null, tss_outlet: w?.tss_outlet ?? null, rainfall_mm: weatherByDate.get(d)?.rainfall_mm ?? null,
    };
  });

  const todayWater = byDate.get(date);
  const today = todayWater || weather
    ? {
        ph_outlet: todayWater?.ph_outlet ?? null,
        tss_outlet: todayWater?.tss_outlet ?? null,
        debit_outlet_m3s: todayWater?.debit_outlet_m3s ?? null,
        debit_outlet_m3d: todayWater?.debit_outlet_m3s == null ? null : m3sToM3d(todayWater.debit_outlet_m3s),
        rainfall_mm: weather?.rainfall_mm ?? null,
        rain_hours: weather?.rain_hours ?? null,
      }
    : null;

  const coagulant = Object.fromEntries(COAGULANT_TYPES.map((t) => {
    const rows = coag.filter((r) => r.type === t);
    const last = rows[rows.length - 1];
    const inRange = rows.filter((r) => r.date >= start && r.stock_remaining !== null).map((r) => r.stock_remaining as number);
    if (last?.stock_remaining != null) inRange.push(last.stock_remaining);
    return [t, {
      remaining: last?.stock_remaining ?? null,
      max: inRange.length ? Math.max(...inRange) : null,
      updated: last?.date ?? null,
    }];
  }));

  const thresholds: Record<string, Threshold> = Object.fromEntries(th.map((r) => [r.key, { min: r.min, max: r.max }]));
  return c.json({ date, days, today, series, coagulant, thresholds });
});
