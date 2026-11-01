import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { addPond, call, login, json } from './helpers';

const D1 = '2026-11-01';
const D2 = '2026-11-02';
const D3 = '2026-11-03';

describe('weather', () => {
  it('put replaces row for same date', async () => {
    const { cookie } = await login('Operator');
    await call(`/weather/${D1}`, { method: 'PUT', cookie, body: json({ rainfall_mm: 5, rain_hours: 2 }) });
    await call(`/weather/${D1}`, { method: 'PUT', cookie, body: json({ rainfall_mm: 8, rain_hours: 3 }) });
    const n = await env.DB.prepare('SELECT COUNT(*) c, MAX(rainfall_mm) r FROM weather').first<any>();
    expect(n.c).toBe(1);
    expect(n.r).toBe(8);
  });
  it('rain_hours above 24 is 400', async () => {
    const { cookie } = await login('Operator');
    expect((await call(`/weather/${D1}`, { method: 'PUT', cookie, body: json({ rainfall_mm: 1, rain_hours: 25 }) })).status).toBe(400);
  });
  it('invalid date is 400', async () => {
    const { cookie } = await login('Operator');
    expect((await call('/weather/2026-13-45', { method: 'PUT', cookie, body: json({ rainfall_mm: 1, rain_hours: 1 }) })).status).toBe(400);
  });
  it('auditor gets 403', async () => {
    const { cookie } = await login('Auditor');
    expect((await call(`/weather/${D1}`, { method: 'PUT', cookie, body: json({ rainfall_mm: 1, rain_hours: 1 }) })).status).toBe(403);
  });
});

describe('water', () => {
  const full = { ph_inlet: 6.5, ph_outlet: 7.2, tss_inlet: 120, tss_outlet: 30, debit_inlet_m3s: 1, debit_outlet_m3s: 0.5 };
  it('second put replaces, one row stays', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await call(`/water/${D1}/${sp}`, { method: 'PUT', cookie, body: json(full) });
    await call(`/water/${D1}/${sp}`, { method: 'PUT', cookie, body: json({ ...full, ph_outlet: 8 }) });
    const n = await env.DB.prepare('SELECT COUNT(*) c, MAX(ph_outlet) p FROM surface_water').first<any>();
    expect(n.c).toBe(1);
    expect(n.p).toBe(8);
  });
  it('blank stores null', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await call(`/water/${D1}/${sp}`, { method: 'PUT', cookie, body: json({ ...full, tss_inlet: '' }) });
    const r = await env.DB.prepare('SELECT tss_inlet FROM surface_water').first<any>();
    expect(r.tss_inlet).toBeNull();
  });
  it('text is 400 with plain error', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    const res = await call(`/water/${D1}/${sp}`, { method: 'PUT', cookie, body: json({ ...full, ph_inlet: 'abc' }) });
    expect(res.status).toBe(400);
    expect(typeof (await res.json() as any).error).toBe('string');
  });
  it('negative flow is 400', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    expect((await call(`/water/${D1}/${sp}`, { method: 'PUT', cookie, body: json({ ...full, debit_inlet_m3s: -1 }) })).status).toBe(400);
  });
  it('pH above 14 is 400', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    expect((await call(`/water/${D1}/${sp}`, { method: 'PUT', cookie, body: json({ ...full, ph_outlet: 15 }) })).status).toBe(400);
  });
  it('inactive pond rejected', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond('SP 9', false);
    expect((await call(`/water/${D1}/${sp}`, { method: 'PUT', cookie, body: json(full) })).status).toBe(409);
  });
  it('unknown pond is 404', async () => {
    const { cookie } = await login('Operator');
    expect((await call(`/water/${D1}/nope`, { method: 'PUT', cookie, body: json(full) })).status).toBe(404);
  });
});

describe('coagulant', () => {
  const put = (cookie: string, date: string, sp: string, b: object, type = 'Kapur') =>
    call(`/coagulant/${date}/${sp}/${encodeURIComponent(type)}`, { method: 'PUT', cookie, body: json(b) });
  const remaining = async (date: string) =>
    (await env.DB.prepare('SELECT stock_remaining r FROM coagulant WHERE date = ?').bind(date).first<any>()).r;

  it('default remaining chains across days', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await put(cookie, D1, sp, { stock_in: 10, stock_out: 3 });
    await put(cookie, D2, sp, { stock_in: 0, stock_out: 2 });
    expect(await remaining(D1)).toBe(7);
    expect(await remaining(D2)).toBe(5);
  });
  it('explicit remaining wins', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await put(cookie, D1, sp, { stock_in: 10, stock_out: 3, stock_remaining: 4 });
    expect(await remaining(D1)).toBe(4);
  });
  it('negative result saved with 200', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    const res = await put(cookie, D1, sp, { stock_in: 0, stock_out: 5 });
    expect(res.status).toBe(200);
    expect(await remaining(D1)).toBe(-5);
  });
  it('out-of-order day uses latest earlier row', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await put(cookie, D1, sp, { stock_in: 10, stock_out: 0 });
    await put(cookie, D3, sp, { stock_in: 0, stock_out: 4 });
    expect(await remaining(D3)).toBe(6);
  });
  it('bad type is 400', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    expect((await put(cookie, D1, sp, { stock_in: 1, stock_out: 1 }, 'Sand')).status).toBe(400);
  });
  it('negative stock_in is 400', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    expect((await put(cookie, D1, sp, { stock_in: -1, stock_out: 0 })).status).toBe(400);
  });
});

describe('day and history', () => {
  it('day returns derived m3/d and previous remaining', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await call(`/water/${D2}/${sp}`, { method: 'PUT', cookie, body: json({ debit_inlet_m3s: 1, debit_outlet_m3s: 0.5 }) });
    await call(`/coagulant/${D1}/${sp}/Kapur`, { method: 'PUT', cookie, body: json({ stock_in: 10, stock_out: 3 }) });
    const day = await (await call(`/day?date=${D2}&sp=${sp}`, { cookie })).json() as any;
    expect(day.water.debit_outlet_m3d).toBe(43200);
    expect(day.water.debit_inlet_m3d).toBe(86400);
    expect(day.previousRemaining.Kapur).toBe(7);
    expect(day.previousRemaining['Tawas Batu']).toBeNull();
    expect(day.coagulant.Kapur).toBeNull();
  });
  it('day with no data returns nulls', async () => {
    const { cookie } = await login('Auditor');
    const sp = await addPond();
    const day = await (await call(`/day?date=${D2}&sp=${sp}`, { cookie })).json() as any;
    expect(day.weather).toBeNull();
    expect(day.water).toBeNull();
  });
  it('day invalid date is 400', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    expect((await call(`/day?date=abc&sp=${sp}`, { cookie })).status).toBe(400);
  });
  it('editing earlier day marks later row stale', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await call(`/coagulant/${D1}/${sp}/Kapur`, { method: 'PUT', cookie, body: json({ stock_in: 10, stock_out: 3 }) });
    await call(`/coagulant/${D2}/${sp}/Kapur`, { method: 'PUT', cookie, body: json({ stock_in: 0, stock_out: 2 }) });
    await call(`/coagulant/${D1}/${sp}/Kapur`, { method: 'PUT', cookie, body: json({ stock_in: 10, stock_out: 6 }) });
    const h = await (await call(`/history?from=${D1}&to=${D3}&sp=${sp}`, { cookie })).json() as any[];
    const d1 = h.find((e) => e.date === D1);
    const d2 = h.find((e) => e.date === D2);
    expect(d1.coagulant.find((c: any) => c.type === 'Kapur').staleRemaining).toBe(false);
    expect(d2.coagulant.find((c: any) => c.type === 'Kapur').staleRemaining).toBe(true);
  });
  it('history includes inactive pond data and lists newest first', async () => {
    const { cookie } = await login('Operator');
    const sp = await addPond();
    await call(`/water/${D1}/${sp}`, { method: 'PUT', cookie, body: json({ ph_inlet: 7 }) });
    await call(`/water/${D2}/${sp}`, { method: 'PUT', cookie, body: json({ ph_inlet: 7 }) });
    await env.DB.prepare('UPDATE settling_ponds SET is_active = 0').run();
    const h = await (await call(`/history?from=${D1}&to=${D3}&sp=${sp}`, { cookie })).json() as any[];
    expect(h.map((e) => e.date)).toEqual([D2, D1]);
  });
  it('history bad range is 400', async () => {
    const { cookie } = await login('Operator');
    expect((await call('/history?from=x&to=y', { cookie })).status).toBe(400);
  });
});
