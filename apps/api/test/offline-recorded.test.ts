import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { addPond, call, json, login } from './helpers';

const T8 = '2026-11-02T08:00:00Z', T7 = '2026-11-02T07:00:00Z', T9 = '2026-11-02T09:00:00Z';
const D = '2026-11-02';

type Case = { name: string; path: (sp: string) => string; body: (v: number) => Record<string, unknown>; read: () => Promise<any>; field: string; table: string };
const cases: Case[] = [
  { name: 'weather', path: () => `/weather/${D}`, body: (v) => ({ rainfall_mm: v, rain_hours: 1 }), field: 'rainfall_mm', table: 'weather',
    read: () => env.DB.prepare('SELECT rainfall_mm v, client_ts FROM weather').first() },
  { name: 'water', path: (sp) => `/water/${D}/${sp}`, body: (v) => ({ ph_inlet: v }), field: 'ph_inlet', table: 'surface_water',
    read: () => env.DB.prepare('SELECT ph_inlet v, client_ts FROM surface_water').first() },
  { name: 'coagulant', path: (sp) => `/coagulant/${D}/${sp}/Kapur`, body: (v) => ({ stock_in: 0, stock_out: v }), field: 'stock_out', table: 'coagulant',
    read: () => env.DB.prepare('SELECT stock_out v, client_ts FROM coagulant').first() },
];

describe.each(cases)('recorded_at: $name', (c) => {
  const put = (cookie: string, sp: string, v: number, recorded_at?: string) =>
    call(c.path(sp), { method: 'PUT', cookie, body: json({ ...c.body(v), ...(recorded_at ? { recorded_at } : {}) }) });

  it('an older recorded_at does not overwrite a newer one', async () => {
    const { cookie } = await login('Operator'); const sp = await addPond();
    expect(((await (await put(cookie, sp, 5, T8)).json()) as any).applied).toBe(true);
    const res = await put(cookie, sp, 9, T7);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).applied).toBe(false);
    expect((await c.read()).v).toBe(5);
  });
  it('the same or a newer recorded_at overwrites', async () => {
    const { cookie } = await login('Operator'); const sp = await addPond();
    await put(cookie, sp, 5, T8);
    expect(((await (await put(cookie, sp, 6, T8)).json()) as any).applied).toBe(true);
    expect(((await (await put(cookie, sp, 7, T9)).json()) as any).applied).toBe(true);
    expect((await c.read()).v).toBe(7);
  });
  it('a write without recorded_at always overwrites, even after one with it', async () => {
    const { cookie } = await login('Operator'); const sp = await addPond();
    await put(cookie, sp, 5, '2026-11-02T23:59:00Z');
    const res = await put(cookie, sp, 8);
    expect(((await res.json()) as any).applied).toBe(true);
    expect((await c.read()).v).toBe(8);
  });
  it('a recorded_at far in the future is accepted but clamped to the server clock', async () => {
    const { cookie } = await login('Operator'); const sp = await addPond();
    expect((await put(cookie, sp, 5, '2999-01-01T00:00:00Z')).status).toBe(200);
    expect(Date.parse((await c.read()).client_ts)).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
  });
  it('an unreadable recorded_at is a 400 with a Indonesian message', async () => {
    const { cookie } = await login('Operator'); const sp = await addPond();
    const res = await put(cookie, sp, 5, 'kemarin');
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe('Waktu pencatatan tidak sah.');
  });
});

describe('coagulant chain with recorded_at', () => {
  it('a stale item does not change the winner\'s stock_remaining', async () => {
    const { cookie } = await login('Operator'); const sp = await addPond();
    const path = `/coagulant/${D}/${sp}/Kapur`;
    await call(path, { method: 'PUT', cookie, body: json({ stock_in: 100, stock_out: 10, recorded_at: T8 }) });
    await call(path, { method: 'PUT', cookie, body: json({ stock_in: 0, stock_out: 99, recorded_at: T7 }) });
    const r = await env.DB.prepare('SELECT stock_remaining r, stock_out o FROM coagulant').first<any>();
    expect(r).toEqual({ r: 90, o: 10 });
  });
});
