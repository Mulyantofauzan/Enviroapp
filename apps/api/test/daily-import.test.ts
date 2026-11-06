import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { addPond, call, login, json } from './helpers';

const BLANK = {
  date: null, pond: null, rainfall: null, rain_hours: null, ph_inlet: null, ph_outlet: null, tss_inlet: null, tss_outlet: null,
  debit_inlet: null, debit_outlet: null, serbuk_in: null, serbuk_out: null, batu_in: null, batu_out: null, kapur_in: null, kapur_out: null,
};
const row = (n: number, o: Record<string, unknown> = {}) => ({ row: n, ...BLANK, date: '2026-04-01', pond: 'SP11', ...o });
const post = (cookie: string, rows: unknown[], dry = false) => call('/entries/import', { method: 'POST', cookie, body: json({ rows, dry }) });
const read = async (r: Response) => (await r.json()) as any;
const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) n FROM ${table}`).first<{ n: number }>())!.n;
async function pond(code = 'SP11', active = true) {
  const id = await addPond(`Settling Pond ${code}`, active);
  await env.DB.prepare('UPDATE settling_ponds SET code = ? WHERE id = ?').bind(code, id).run();
  return id;
}

describe('daily import: access and limits', () => {
  it.each(['Operator', 'Manager', 'Auditor'] as const)('%s cannot import', async (role) => {
    const { cookie } = await login(role);
    expect((await post(cookie, [row(2)])).status).toBe(403);
  });
  it('needs 1 to 1000 rows', async () => {
    const { cookie } = await login('Admin');
    const none = await post(cookie, []);
    expect(none.status).toBe(400);
    expect((await read(none)).error).toBe('Berkas harus berisi 1 sampai 1000 baris.');
    expect((await post(cookie, Array.from({ length: 1001 }, (_, i) => row(i + 2)))).status).toBe(400);
  });
});

describe('daily import: dry run versus save', () => {
  it('dry run reports and writes nothing', async () => {
    const { cookie } = await login('Admin');
    await pond();
    const r = await read(await post(cookie, [row(2, { rainfall: '5', ph_outlet: '7', serbuk_out: '50' })], true));
    expect(r.summary).toEqual({ create: 1, update: 0, unchanged: 0, error: 0 });
    expect(r.rows[0]).toMatchObject({ row: 2, date: '2026-04-01', pond: 'SP11', status: 'create', parts: ['cuaca', 'air', 'koagulan'] });
    expect([await count('weather'), await count('surface_water'), await count('coagulant')]).toEqual([0, 0, 0]);
  });
  it('saves weather, water (L/s -> m3/s) and each coagulant type', async () => {
    const { cookie } = await login('Admin');
    const sp = await pond();
    await post(cookie, [row(2, { rainfall: '5,5', rain_hours: '2', ph_inlet: '6,8', ph_outlet: '7', tss_outlet: '1.234,5', debit_inlet: '500', debit_outlet: '250', serbuk_in: '100', serbuk_out: '25', batu_out: '10' })]);
    expect(await env.DB.prepare('SELECT rainfall_mm, rain_hours FROM weather WHERE date = ?').bind('2026-04-01').first()).toEqual({ rainfall_mm: 5.5, rain_hours: 2 });
    const w = await env.DB.prepare('SELECT * FROM surface_water WHERE sp_id = ?').bind(sp).first<any>();
    expect(w).toMatchObject({ date: '2026-04-01', ph_inlet: 6.8, ph_outlet: 7, tss_outlet: 1234.5, debit_inlet_m3s: 0.5, debit_outlet_m3s: 0.25 });
    const c = (await env.DB.prepare('SELECT type, stock_in, stock_out, stock_remaining FROM coagulant WHERE sp_id = ? ORDER BY type').bind(sp).all<any>()).results;
    expect(c).toEqual([
      { type: 'Tawas Batu', stock_in: null, stock_out: 10, stock_remaining: -10 },
      { type: 'Tawas Serbuk', stock_in: 100, stock_out: 25, stock_remaining: 75 },
    ]);
  });
  it('matches the pond code ignoring case', async () => {
    const { cookie } = await login('Admin');
    await pond('SP11');
    const r = await read(await post(cookie, [row(2, { pond: ' sp11 ', ph_outlet: '7' })]));
    expect(r.summary.create).toBe(1);
  });
  it('importing the same file twice creates no duplicates', async () => {
    const { cookie } = await login('Admin');
    await pond();
    const rows = [row(2, { rainfall: '5', ph_outlet: '7', debit_outlet: '250', serbuk_in: '100', serbuk_out: '25' }), row(3, { date: '2026-04-02', ph_outlet: '6,5' })];
    await post(cookie, rows);
    const second = await read(await post(cookie, rows));
    expect(second.summary).toEqual({ create: 0, update: 0, unchanged: 2, error: 0 });
    expect([await count('weather'), await count('surface_water'), await count('coagulant')]).toEqual([1, 2, 1]);
  });
  it('reports a changed value as an update', async () => {
    const { cookie } = await login('Admin');
    await pond();
    await post(cookie, [row(2, { ph_outlet: '7' })]);
    const r = await read(await post(cookie, [row(2, { ph_outlet: '6,5' })]));
    expect(r.summary).toMatchObject({ update: 1, create: 0 });
    expect((await env.DB.prepare('SELECT ph_outlet FROM surface_water').first<any>()).ph_outlet).toBe(6.5);
  });
});

describe('daily import: empty cells and no flow', () => {
  it('an empty cell never wipes a stored value', async () => {
    const { cookie } = await login('Admin');
    await pond();
    await post(cookie, [row(2, { ph_outlet: '7', tss_outlet: '40' })]);
    const r = await read(await post(cookie, [row(2, { ph_outlet: '', tss_outlet: '45', debit_outlet: 'no data' })]));
    expect(r.summary.update).toBe(1);
    expect(await env.DB.prepare('SELECT ph_outlet, tss_outlet, debit_outlet_m3s FROM surface_water').first()).toEqual({ ph_outlet: 7, tss_outlet: 45, debit_outlet_m3s: null });
  });
  it('a row of only blanks is unchanged and writes nothing', async () => {
    const { cookie } = await login('Admin');
    await pond();
    const r = await read(await post(cookie, [row(2)]));
    expect(r.rows[0].status).toBe('unchanged');
    expect([await count('weather'), await count('surface_water'), await count('coagulant')]).toEqual([0, 0, 0]);
  });
  it('stores a no-flow day as typed: zero debit and zero pH', async () => {
    const { cookie } = await login('Admin');
    await pond();
    await post(cookie, [row(2, { debit_outlet: '0', ph_outlet: '0', tss_outlet: 'No Flow' })]);
    expect(await env.DB.prepare('SELECT ph_outlet, tss_outlet, debit_outlet_m3s FROM surface_water').first()).toEqual({ ph_outlet: 0, tss_outlet: null, debit_outlet_m3s: 0 });
  });
});

describe('daily import: row errors', () => {
  it('flags an unknown or inactive pond and still saves the other rows', async () => {
    const { cookie } = await login('Admin');
    await pond('SP11');
    await pond('SP99', false);
    const r = await read(await post(cookie, [row(2, { ph_outlet: '7' }), row(3, { pond: 'SP50', ph_outlet: '7' }), row(4, { pond: 'SP99', ph_outlet: '7' })]));
    expect(r.rows.map((x: any) => x.status)).toEqual(['create', 'error', 'error']);
    expect(r.rows[1].message).toBe('Pond dengan kode SP50 tidak ditemukan.');
    expect(r.rows[2].message).toBe('Pond SP99 nonaktif.');
    expect(await count('surface_water')).toBe(1);
  });
  it('flags a row the shared validation rejects', async () => {
    const { cookie } = await login('Admin');
    await pond();
    const r = await read(await post(cookie, [row(2, { ph_outlet: '15' }), row(3, { date: '2999-01-01' })]));
    expect(r.rows[0]).toMatchObject({ status: 'error', message: 'pH outlet harus antara 0 dan 14.' });
    expect(r.rows[1]).toMatchObject({ status: 'error', message: 'Tanggal tidak boleh di masa depan.' });
  });
  it('flags a duplicate date and pond', async () => {
    const { cookie } = await login('Admin');
    await pond();
    const r = await read(await post(cookie, [row(2, { ph_outlet: '7' }), row(5, { ph_outlet: '8' })]));
    expect(r.rows[1]).toMatchObject({ status: 'error', message: 'Baris ganda dengan baris 2.' });
    expect(r.rows[0].status).toBe('create');
  });
  it('flags both rows when one date has two different rainfall values', async () => {
    const { cookie } = await login('Admin');
    await pond('SP11');
    await pond('SP02');
    const r = await read(await post(cookie, [row(2, { rainfall: '5' }), row(3, { pond: 'SP02', rainfall: '9' })]));
    expect(r.rows.map((x: any) => x.status)).toEqual(['error', 'error']);
    expect(r.rows[0].message).toContain('baris 3');
    expect(await count('weather')).toBe(0);
  });
  it('accepts the same rainfall on two ponds, or rainfall on only one', async () => {
    const { cookie } = await login('Admin');
    await pond('SP11');
    await pond('SP02');
    const r = await read(await post(cookie, [row(2, { rainfall: '5', ph_outlet: '7' }), row(3, { pond: 'SP02', rainfall: '5,0', ph_outlet: '7' }), row(4, { date: '2026-04-02', rainfall: '3' }), row(5, { date: '2026-04-02', pond: 'SP02', ph_outlet: '7' })]));
    expect(r.summary.error).toBe(0);
    expect(await count('weather')).toBe(2);
  });
});

describe('daily import: coagulant stock', () => {
  it('chains the remaining stock by date even when the rows are out of order', async () => {
    const { cookie } = await login('Admin');
    const sp = await pond();
    await post(cookie, [
      row(4, { date: '2026-04-03', kapur_out: '5' }),
      row(2, { date: '2026-04-01', kapur_in: '100', kapur_out: '10' }),
      row(3, { date: '2026-04-02', kapur_out: '20' }),
    ]);
    const c = (await env.DB.prepare("SELECT date, stock_remaining FROM coagulant WHERE sp_id = ? AND type = 'Kapur' ORDER BY date").bind(sp).all<any>()).results;
    expect(c.map((x) => x.stock_remaining)).toEqual([90, 70, 65]);
  });
  it('starts from the stock already stored before the first imported date', async () => {
    const { cookie } = await login('Admin');
    const sp = await pond();
    await env.DB.prepare("INSERT INTO coagulant (id,date,sp_id,type,stock_in,stock_out,stock_remaining,logged_by) VALUES ('c0','2026-03-31',?,'Kapur',50,0,50,(SELECT id FROM users LIMIT 1))").bind(sp).run();
    await post(cookie, [row(2, { kapur_out: '8' })]);
    expect((await env.DB.prepare("SELECT stock_remaining FROM coagulant WHERE date = '2026-04-01'").first<any>()).stock_remaining).toBe(42);
  });
});
