import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { addPond, call, login, json } from './helpers';
import { app } from '../src/index';

const D = '2026-11-02';

async function seed(cookie: string, sp: string) {
  for (const [date, pin, pout] of [['2026-10-31', 6.8, 6.2], ['2026-11-01', 6.4, 5.8], [D, 6.1, 5.6]] as const)
    await call(`/water/${date}/${sp}`, { method: 'PUT', cookie, body: json({ ph_inlet: pin, ph_outlet: pout, tss_outlet: 38, debit_outlet_m3s: 0.0148 }) });
  await call(`/weather/${D}`, { method: 'PUT', cookie, body: json({ rainfall_mm: 12.5, rain_hours: 3.5 }) });
}

describe('GET /dashboard', () => {
  it('rejects days other than 7, 30, 90', async () => {
    const { cookie } = await login('Manager');
    const sp = await addPond();
    expect((await call(`/dashboard?sp=${sp}&days=14&date=${D}`, { cookie })).status).toBe(400);
  });
  it('unknown pond is 404', async () => {
    const { cookie } = await login('Manager');
    expect((await call(`/dashboard?sp=nope&days=7&date=${D}`, { cookie })).status).toBe(404);
  });
  it('invalid date is 400', async () => {
    const { cookie } = await login('Manager');
    const sp = await addPond();
    expect((await call(`/dashboard?sp=${sp}&days=7&date=abc`, { cookie })).status).toBe(400);
  });
  it('series has exactly `days` entries, ascending, null for missing days', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await seed(cookie, sp);
    const d = await (await call(`/dashboard?sp=${sp}&days=7&date=${D}`, { cookie })).json() as any;
    expect(d.series).toHaveLength(7);
    expect(d.series.map((s: any) => s.date)).toEqual(['2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02']);
    expect(d.series[0]).toMatchObject({ ph_inlet: null, ph_outlet: null });
    expect(d.series[6]).toMatchObject({ ph_inlet: 6.1, ph_outlet: 5.6, debit_outlet_m3s: 0.0148 });
    expect(d.series[0].debit_outlet_m3s).toBeNull();
  });
  it('each day also carries TSS inlet/outlet and the site-wide rainfall, null when missing', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await call(`/water/${D}/${sp}`, { method: 'PUT', cookie, body: json({ ph_outlet: 7, tss_inlet: 120, tss_outlet: 38 }) });
    await call('/weather/2026-10-31', { method: 'PUT', cookie, body: json({ rainfall_mm: 4.5, rain_hours: 1 }) });
    await call(`/weather/${D}`, { method: 'PUT', cookie, body: json({ rainfall_mm: 12.5, rain_hours: 3.5 }) });
    const d = await (await call(`/dashboard?sp=${sp}&days=7&date=${D}`, { cookie })).json() as any;
    const by = Object.fromEntries(d.series.map((x: any) => [x.date, x]));
    expect(by[D]).toMatchObject({ tss_inlet: 120, tss_outlet: 38, rainfall_mm: 12.5 });
    expect(by['2026-10-31']).toMatchObject({ tss_inlet: null, tss_outlet: null, rainfall_mm: 4.5 });
    expect(by['2026-10-29']).toMatchObject({ tss_inlet: null, tss_outlet: null, rainfall_mm: null });
  });
  it('rainfall does not depend on which pond is asked for', async () => {
    const { cookie } = await login('Operator');
    const a = await addPond('A');
    const b = await addPond('B');
    await call(`/weather/${D}`, { method: 'PUT', cookie, body: json({ rainfall_mm: 9, rain_hours: 2 }) });
    for (const sp of [a, b]) {
      const d = await (await call(`/dashboard?sp=${sp}&days=7&date=${D}`, { cookie })).json() as any;
      expect(d.series.at(-1).rainfall_mm).toBe(9);
    }
  });
  it('today carries derived m3/d and weather', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await seed(cookie, sp);
    const d = await (await call(`/dashboard?sp=${sp}&days=7&date=${D}`, { cookie })).json() as any;
    expect(d.today.ph_outlet).toBe(5.6);
    expect(d.today.tss_outlet).toBe(38);
    expect(d.today.debit_outlet_m3d).toBeCloseTo(0.0148 * 86400, 6);
    expect(d.today.debit_outlet_ls).toBe(14.8);
    expect(d.today.rainfall_mm).toBe(12.5);
    expect(d.today.rain_hours).toBe(3.5);
  });
  it('today is null when nothing exists on that date', async () => {
    const { cookie } = await login('Manager');
    const sp = await addPond();
    const d = await (await call(`/dashboard?sp=${sp}&days=7&date=${D}`, { cookie })).json() as any;
    expect(d.today).toBeNull();
    expect(d.series.every((s: any) => s.ph_outlet === null)).toBe(true);
  });
  it('coagulant: latest remaining and highest in range', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await call(`/coagulant/2026-10-30/${sp}/Kapur`, { method: 'PUT', cookie, body: json({ stock_in: 300, stock_out: 0 }) });
    await call(`/coagulant/${D}/${sp}/Kapur`, { method: 'PUT', cookie, body: json({ stock_in: 0, stock_out: 40 }) });
    const d = await (await call(`/dashboard?sp=${sp}&days=7&date=${D}`, { cookie })).json() as any;
    expect(d.coagulant.Kapur).toEqual({ remaining: 260, max: 300, updated: D });
    expect(d.coagulant['Tawas Batu']).toEqual({ remaining: null, max: null, updated: null });
  });
  it('stock entered before the range still gets a full bar scale', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await call(`/coagulant/2026-10-20/${sp}/Kapur`, { method: 'PUT', cookie, body: json({ stock_in: 300, stock_out: 0 }) });
    const d = await (await call(`/dashboard?sp=${sp}&days=7&date=${D}`, { cookie })).json() as any;
    expect(d.coagulant.Kapur).toEqual({ remaining: 300, max: 300, updated: '2026-10-20' });
  });
  it('old history outside the range never leaks into max, only the latest entry counts', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await call(`/coagulant/2026-01-05/${sp}/Kapur`, { method: 'PUT', cookie, body: json({ stock_in: 9999, stock_out: 0 }) });
    await call(`/coagulant/2026-10-20/${sp}/Kapur`, { method: 'PUT', cookie, body: json({ stock_in: 0, stock_out: 9699 }) });
    const d = await (await call(`/dashboard?sp=${sp}&days=7&date=${D}`, { cookie })).json() as any;
    expect(d.coagulant.Kapur).toEqual({ remaining: 300, max: 300, updated: '2026-10-20' });
  });
  it('coagulant lookups by pond and type use an index, not a table scan', async () => {
    const plan = (await env.DB.prepare(
      'EXPLAIN QUERY PLAN SELECT stock_remaining FROM coagulant WHERE sp_id = ? AND type = ? AND date <= ? ORDER BY date DESC LIMIT 1',
    ).bind('x', 'Kapur', D).all<any>()).results.map((r) => r.detail).join(' | ');
    expect(plan).toContain('idx_coagulant_sp_type_date');
  });
  it('returns the pond thresholds', async () => {
    const admin = await login('Admin');
    const created = await (await call('/ponds', { method: 'POST', cookie: admin.cookie, body: json({ name: 'SP-02', thresholds: { ph_outlet: { min: 6, max: 9 } } }) })).json() as any;
    const d = await (await call(`/dashboard?sp=${created.id}&days=7&date=${D}`, { cookie: admin.cookie })).json() as any;
    expect(d.thresholds.ph_outlet).toEqual({ min: 6, max: 9 });
  });
  it.each(['Auditor', 'Manager', 'Operator', 'Admin'] as const)('%s can read', async (role) => {
    const { cookie } = await login(role);
    const sp = await addPond();
    expect((await call(`/dashboard?sp=${sp}&days=30&date=${D}`, { cookie })).status).toBe(200);
  });
  it('needs a session', async () => {
    const sp = await addPond();
    expect((await call(`/dashboard?sp=${sp}&days=7&date=${D}`)).status).toBe(401);
  });
  it('uses a small fixed number of queries', async () => {
    const { cookie } = await login('Manager');
    const sp = await addPond();
    await seed(cookie, sp);
    let q = 0;
    const counting = new Proxy(env.DB, {
      get(t, p) {
        if (p === 'prepare') return (sql: string) => { q++; return t.prepare(sql); };
        const v = (t as any)[p];
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    const res = await app.request(`/api/dashboard?sp=${sp}&days=90&date=${D}`, { headers: { cookie } }, { DB: counting });
    expect(res.status).toBe(200);
    expect(q).toBeLessThanOrEqual(6);
  });

  describe('summary', () => {
    const put = (cookie: string, path: string, b: object) => call(path, { method: 'PUT', cookie, body: json(b) });
    it('compares this period with the previous one of the same length', async () => {
      const { cookie } = await login('Operator');
      const sp = await addPond();
      await env.DB.prepare("INSERT INTO pond_thresholds (sp_id,key,min,max) VALUES (?,?,?,?)").bind(sp, 'tss_outlet', null, 50).run();
      // current 7 days: 2026-10-27..2026-11-02 ; previous: 2026-10-20..2026-10-26
      await put(cookie, `/water/${D}/${sp}`, { tss_outlet: 60, debit_outlet_m3s: 0.01 });
      await put(cookie, `/water/2026-11-01/${sp}`, { tss_outlet: 40, debit_outlet_m3s: 0.01 });
      await put(cookie, `/water/2026-10-31/${sp}`, { tss_outlet: 0, debit_outlet_m3s: 0 });
      await put(cookie, `/water/2026-10-25/${sp}`, { tss_outlet: 55, debit_outlet_m3s: 0.01 });
      await put(cookie, `/weather/${D}`, { rainfall_mm: 12.5, rain_hours: 3 });
      await put(cookie, `/weather/2026-10-24`, { rainfall_mm: 7, rain_hours: 1 });
      await put(cookie, `/coagulant/2026-11-01/${sp}/Kapur`, { stock_in: 100, stock_out: 30 });
      await put(cookie, `/coagulant/${D}/${sp}/Tawas Batu`, { stock_in: 50, stock_out: 20 });
      await put(cookie, `/coagulant/2026-10-21/${sp}/Kapur`, { stock_in: 0, stock_out: 8 });
      const d = await (await call(`/dashboard?sp=${sp}&days=7&date=${D}`, { cookie })).json() as any;
      expect(d.summary.current.tss).toEqual({ checked: 2, violations: 1, compliant_pct: 50 });
      expect(d.summary.current.noflow_days).toBe(1);
      expect(d.summary.current.rain_total_mm).toBe(12.5);
      expect(d.summary.current.coag_out_kg).toBe(50);
      expect(d.summary.current.avg_tss_outlet).toBe(50);
      expect(d.summary.previous.tss).toEqual({ checked: 1, violations: 1, compliant_pct: 0 });
      expect(d.summary.previous.rain_total_mm).toBe(7);
      expect(d.summary.previous.coag_out_kg).toBe(8);
      expect(d.series).toHaveLength(7);
    });
    it('is empty, not an error, when there is no data', async () => {
      const { cookie } = await login('Operator');
      const sp = await addPond();
      const d = await (await call(`/dashboard?sp=${sp}&days=30&date=${D}`, { cookie })).json() as any;
      expect(d.summary.current.ph.compliant_pct).toBeNull();
      expect(d.summary.previous.coag_out_kg).toBeNull();
    });
  });
});
