import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { requireAuth, requireWrite } from '../auth/guard';
import { activePond, badDate, isFail, readBody, readNumbers } from './common';

export const waterRoutes = new Hono<AppEnv>();
waterRoutes.use('*', requireAuth);

waterRoutes.put('/:date/:sp', requireWrite, async (c) => {
  const date = c.req.param('date');
  const sp = c.req.param('sp');
  const bad = badDate(c, date);
  if (bad) return bad;
  const pond = await activePond(c, sp);
  if (pond) return pond;
  const ph = { min: 0, max: 14 };
  const pos = { min: 0 };
  const v = readNumbers(c, await readBody(c),
    { ph_inlet: ph, ph_outlet: ph, tss_inlet: pos, tss_outlet: pos, debit_inlet_m3s: pos, debit_outlet_m3s: pos },
    { ph_inlet: 'pH inlet', ph_outlet: 'pH outlet', tss_inlet: 'TSS inlet', tss_outlet: 'TSS outlet',
      debit_inlet_m3s: 'Flow inlet', debit_outlet_m3s: 'Flow outlet' });
  if (isFail(v)) return v.fail;
  await c.env.DB.prepare(
    `INSERT INTO surface_water (id,date,sp_id,ph_inlet,ph_outlet,tss_inlet,tss_outlet,debit_inlet_m3s,debit_outlet_m3s,logged_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(date,sp_id) DO UPDATE SET ph_inlet=excluded.ph_inlet, ph_outlet=excluded.ph_outlet,
       tss_inlet=excluded.tss_inlet, tss_outlet=excluded.tss_outlet,
       debit_inlet_m3s=excluded.debit_inlet_m3s, debit_outlet_m3s=excluded.debit_outlet_m3s, logged_by=excluded.logged_by`,
  ).bind(crypto.randomUUID(), date, sp, v.ph_inlet, v.ph_outlet, v.tss_inlet, v.tss_outlet,
    v.debit_inlet_m3s, v.debit_outlet_m3s, c.get('user').id).run();
  return c.json({ date, sp_id: sp, ...v });
});
