import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { CATEGORY_PALETTE, todayInSite } from '@evo/shared';
import { call, login, json } from './helpers';

const T = todayInSite();
const row = (n: number, o: Record<string, unknown> = {}) => ({ row: n, category: 'Air Limbah', title: `Event ${n}`, frequency: 'Bulanan', start: T, ...o });
const post = (cookie: string, rows: unknown[], dry = false) => call('/schedules/import', { method: 'POST', cookie, body: json({ rows, dry }) });
const read = async (r: Response) => (await r.json()) as any;
const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) n FROM ${table}`).first<{ n: number }>())!.n;

describe('schedule import: access and limits', () => {
  it.each(['Operator', 'Auditor'] as const)('%s cannot import', async (role) => {
    const { cookie } = await login(role);
    expect((await post(cookie, [row(2)])).status).toBe(403);
  });
  it('needs 1 to 500 rows', async () => {
    const { cookie } = await login('Manager');
    const none = await post(cookie, []);
    expect(none.status).toBe(400);
    expect((await read(none)).error).toBe('Berkas harus berisi 1 sampai 500 baris.');
    expect((await post(cookie, Array.from({ length: 501 }, (_, i) => row(i + 2)))).status).toBe(400);
    expect((await post(cookie, Array.from({ length: 500 }, (_, i) => row(i + 2, { category: null })), true)).status).toBe(200);
  });
});

describe('schedule import: dry run versus save', () => {
  it('dry run reports what would happen and writes nothing', async () => {
    const { cookie } = await login('Manager');
    const r = await read(await post(cookie, [row(2)], true));
    expect(r.rows[0]).toMatchObject({ row: 2, status: 'create', newCategory: true });
    expect(r.summary).toMatchObject({ create: 1, update: 0, unchanged: 0, skipped: 0, error: 0, newCategories: ['Air Limbah'] });
    expect(await count('event_schedules')).toBe(0);
    expect(await count('event_categories')).toBe(0);
  });
  it('saving creates the schedule and a category with the first palette color', async () => {
    const { cookie } = await login('Manager');
    await post(cookie, [row(2)]);
    const k = await env.DB.prepare('SELECT name, color, is_active FROM event_categories').first<any>();
    expect(k).toEqual({ name: 'Air Limbah', color: CATEGORY_PALETTE[0], is_active: 1 });
    const s = await env.DB.prepare('SELECT title, frequency, start_date, category_id FROM event_schedules').first<any>();
    expect(s).toMatchObject({ title: 'Event 2', frequency: 'Monthly', start_date: T });
    expect(s.category_id).not.toBeNull();
  });
  it('a date in the frequency cell is saved as Annual from that date', async () => {
    const { cookie } = await login('Manager');
    await post(cookie, [row(2, { frequency: '15/01/2027', start: null })]);
    expect(await env.DB.prepare('SELECT frequency, start_date FROM event_schedules').first()).toEqual({ frequency: 'Annual', start_date: '2027-01-15' });
  });
  it('importing the same file twice makes no duplicates and says unchanged', async () => {
    const { cookie } = await login('Manager');
    const rows = [row(2), row(3, { category: null })];
    await post(cookie, rows);
    const again = await read(await post(cookie, rows));
    expect(again.rows.map((r: any) => r.status)).toEqual(['unchanged', 'unchanged']);
    expect(await count('event_schedules')).toBe(2);
    expect(await count('event_categories')).toBe(1);
  });
});

describe('schedule import: categories', () => {
  it('names that differ in case or spacing are one category, created once', async () => {
    const { cookie } = await login('Manager');
    await post(cookie, [row(2, { category: 'Air Limbah' }), row(3, { category: 'air  limbah' }), row(4, { category: 'AIR LIMBAH ' })]);
    expect(await count('event_categories')).toBe(1);
    const ids = (await env.DB.prepare('SELECT DISTINCT category_id FROM event_schedules').all()).results;
    expect(ids).toHaveLength(1);
  });
  it('new categories get consecutive unused palette colors', async () => {
    const { cookie } = await login('Manager');
    await post(cookie, [row(2, { category: 'A' }), row(3, { category: 'B' })]);
    const colors = (await env.DB.prepare('SELECT color FROM event_categories ORDER BY name').all<any>()).results.map((r) => r.color);
    expect(colors).toEqual([CATEGORY_PALETTE[0], CATEGORY_PALETTE[1]]);
  });
  it('an existing category, even an inactive one, is reused and not re-created', async () => {
    const { cookie } = await login('Manager');
    await env.DB.prepare("INSERT INTO event_categories (id,name,color,is_active,created_at) VALUES ('k1','Lama','#2E7D32',0,'x')").run();
    const r = await read(await post(cookie, [row(2, { category: 'lama' })]));
    expect(r.rows[0].newCategory).toBeFalsy();
    expect(await count('event_categories')).toBe(1);
    expect((await env.DB.prepare('SELECT category_id FROM event_schedules').first<any>()).category_id).toBe('k1');
  });
  it('a blank category means no category', async () => {
    const { cookie } = await login('Manager');
    await post(cookie, [row(2, { category: '  ' })]);
    expect((await env.DB.prepare('SELECT category_id FROM event_schedules').first<any>()).category_id).toBeNull();
  });
});

describe('schedule import: matching existing events', () => {
  const existing = async (by: string, o: Record<string, unknown> = {}) => {
    const id = crypto.randomUUID();
    const s = { title: 'Event 2', frequency: 'Weekly', start_date: '2026-01-05', ended_on: null, category_id: null, ...o };
    await env.DB.prepare('INSERT INTO event_schedules (id,title,frequency,start_date,ended_on,category_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(id, s.title, s.frequency, s.start_date, s.ended_on, s.category_id, by, 'x').run();
    return id;
  };
  it('same title and category with another frequency is updated', async () => {
    const { cookie, user } = await login('Manager');
    const id = await existing(user.id);
    const r = await read(await post(cookie, [row(2, { category: null, title: ' event  2 ' })]));
    expect(r.rows[0].status).toBe('update');
    expect(await env.DB.prepare('SELECT frequency, start_date FROM event_schedules WHERE id = ?').bind(id).first()).toEqual({ frequency: 'Monthly', start_date: T });
    expect(await count('event_schedules')).toBe(1);
  });
  it('the same title in a different category is a different event', async () => {
    const { cookie, user } = await login('Manager');
    await existing(user.id);
    const r = await read(await post(cookie, [row(2)]));
    expect(r.rows[0].status).toBe('create');
    expect(await count('event_schedules')).toBe(2);
  });
  it('an event that already has a completion is skipped with a reason and left alone', async () => {
    const { cookie, user } = await login('Manager');
    const id = await existing(user.id);
    await env.DB.prepare("INSERT INTO event_completions (schedule_id,due_date,completed_by,completed_at,completed_on) VALUES (?,?,?,?,?)").bind(id, '2026-01-05', user.id, 'x', '2026-01-05').run();
    const r = await read(await post(cookie, [row(2, { category: null })]));
    expect(r.rows[0]).toMatchObject({ status: 'skipped', message: 'Sudah punya catatan, frekuensi dan tanggal mulai tidak bisa diubah.' });
    expect((await env.DB.prepare('SELECT frequency FROM event_schedules WHERE id = ?').bind(id).first<any>()).frequency).toBe('Weekly');
  });
  it('a stopped event does not match; a fresh one is made', async () => {
    const { cookie, user } = await login('Manager');
    await existing(user.id, { ended_on: '2026-02-01' });
    const r = await read(await post(cookie, [row(2, { category: null })]));
    expect(r.rows[0].status).toBe('create');
    expect(await count('event_schedules')).toBe(2);
  });
});

describe('schedule import: bad rows', () => {
  it('two rows for the same event: the second is an error naming the first, the first still saves', async () => {
    const { cookie } = await login('Manager');
    const r = await read(await post(cookie, [row(2), row(3, { title: 'event 2', category: 'AIR limbah' })]));
    expect(r.rows.map((x: any) => x.status)).toEqual(['create', 'error']);
    expect(r.rows[1].message).toBe('Baris ganda dengan baris 2.');
    expect(await count('event_schedules')).toBe(1);
  });
  it('good rows still save when others fail, and each failure is explained', async () => {
    const { cookie } = await login('Manager');
    const r = await read(await post(cookie, [row(2), row(3, { frequency: 'sering' }), row(4, { title: '' }), row(5, { start: null })]));
    expect(r.rows.map((x: any) => x.status)).toEqual(['create', 'error', 'error', 'error']);
    expect(r.rows[2].message).toBe('Judul wajib diisi.');
    expect(r.summary).toMatchObject({ create: 1, error: 3 });
    expect(await count('event_schedules')).toBe(1);
  });
  it('a category used only by failed rows is not created', async () => {
    const { cookie } = await login('Manager');
    await post(cookie, [row(2, { category: 'Hantu', frequency: 'sering' })]);
    expect(await count('event_categories')).toBe(0);
  });
});
