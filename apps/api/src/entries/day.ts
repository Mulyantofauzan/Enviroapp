import { Hono } from 'hono';
import { COAGULANT_TYPES, m3sToLs, m3sToM3d } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth } from '../auth/guard';
import { badDate } from './common';
import { previousRemaining } from './coagulant';

export const dayRoutes = new Hono<AppEnv>();
dayRoutes.use('*', requireAuth);

export const withDerivedFlow = (w: any) =>
  w && {
    ...w,
    debit_inlet_m3d: w.debit_inlet_m3s === null ? null : m3sToM3d(w.debit_inlet_m3s),
    debit_outlet_m3d: w.debit_outlet_m3s === null ? null : m3sToM3d(w.debit_outlet_m3s),
    debit_inlet_ls: w.debit_inlet_m3s === null ? null : m3sToLs(w.debit_inlet_m3s),
    debit_outlet_ls: w.debit_outlet_m3s === null ? null : m3sToLs(w.debit_outlet_m3s),
  };

dayRoutes.get('/', async (c) => {
  const date = c.req.query('date') ?? '';
  const sp = c.req.query('sp') ?? '';
  const bad = badDate(c, date);
  if (bad) return bad;
  if (!sp) return c.json({ error: 'Pilih settling pond dulu.' }, 400);
  const db = c.env.DB;
  const weather = await db.prepare('SELECT date,rainfall_mm,rain_hours FROM weather WHERE date = ?').bind(date).first();
  const water = await db.prepare(
    `SELECT date,sp_id,ph_inlet,ph_outlet,tss_inlet,tss_outlet,debit_inlet_m3s,debit_outlet_m3s
     FROM surface_water WHERE date = ? AND sp_id = ?`).bind(date, sp).first();
  const coagulant: Record<string, unknown> = {};
  const previous: Record<string, number | null> = {};
  for (const t of COAGULANT_TYPES) {
    coagulant[t] = await db.prepare(
      'SELECT type,stock_in,stock_out,stock_remaining FROM coagulant WHERE date = ? AND sp_id = ? AND type = ?')
      .bind(date, sp, t).first();
    previous[t] = await previousRemaining(db, sp, t, date);
  }
  return c.json({ weather, water: withDerivedFlow(water), coagulant, previousRemaining: previous });
});
