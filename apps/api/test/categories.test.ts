import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { CATEGORY_PALETTE } from '@evo/shared';
import { call, login, json } from './helpers';

const P = CATEGORY_PALETTE;
const make = (cookie: string, name = 'Air Limbah', color = P[0]) => call('/event-categories', { method: 'POST', cookie, body: json({ name, color }) });
const errOf = async (r: Response) => ((await r.json()) as any).error as string;

async function addSchedule(by: string, categoryId: string, ended: string | null = null) {
  await env.DB.prepare('INSERT INTO event_schedules (id,title,frequency,start_date,ended_on,category_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), 'E', 'Daily', '2026-11-01', ended, categoryId, by, new Date().toISOString()).run();
}

describe('event categories: who can do what', () => {
  it.each(['Manager', 'Admin'] as const)('%s can create and change', async (role) => {
    const { cookie } = await login(role);
    const res = await make(cookie);
    expect(res.status).toBe(201);
    const id = ((await res.json()) as any).id;
    expect((await call(`/event-categories/${id}`, { method: 'PATCH', cookie, body: json({ name: 'Udara' }) })).status).toBe(200);
  });
  it.each(['Operator', 'Auditor'] as const)('%s can read but not write', async (role) => {
    const mgr = await login('Manager');
    const id = ((await (await make(mgr.cookie)).json()) as any).id;
    const { cookie } = await login(role);
    expect((await call('/event-categories', { cookie })).status).toBe(200);
    expect((await make(cookie, 'Lain')).status).toBe(403);
    expect((await call(`/event-categories/${id}`, { method: 'PATCH', cookie, body: json({ name: 'X' }) })).status).toBe(403);
  });
  it('needs a session', async () => expect((await call('/event-categories')).status).toBe(401));
});

describe('event categories: rules', () => {
  it('a name that differs only in case or spacing is a duplicate', async () => {
    const { cookie } = await login('Manager');
    await make(cookie, 'Air Limbah');
    const res = await make(cookie, 'air  limbah', P[1]);
    expect(res.status).toBe(409);
    expect(await errOf(res)).toBe('Nama kategori sudah dipakai.');
  });
  it('renaming onto another category name is 409', async () => {
    const { cookie } = await login('Manager');
    await make(cookie, 'A');
    const id = ((await (await make(cookie, 'B', P[1])).json()) as any).id;
    expect((await call(`/event-categories/${id}`, { method: 'PATCH', cookie, body: json({ name: 'a' }) })).status).toBe(409);
  });
  it('rejects a blank or too long name and a color outside the palette', async () => {
    const { cookie } = await login('Manager');
    const blank = await make(cookie, '  ');
    expect(blank.status).toBe(400);
    expect(await errOf(blank)).toBe('Nama kategori wajib diisi, maksimal 60 karakter.');
    expect((await make(cookie, 'x'.repeat(61))).status).toBe(400);
    const bad = await make(cookie, 'Warna', '#123456');
    expect(bad.status).toBe(400);
    expect(await errOf(bad)).toBe('Pilih warna dari palet.');
  });
  it('unknown id is 404', async () => {
    const { cookie } = await login('Manager');
    const res = await call('/event-categories/nope', { method: 'PATCH', cookie, body: json({ name: 'X' }) });
    expect(res.status).toBe(404);
    expect(await errOf(res)).toBe('Kategori tidak ditemukan.');
  });
  it('deactivating keeps the row and reports is_active false', async () => {
    const { cookie } = await login('Manager');
    const id = ((await (await make(cookie)).json()) as any).id;
    await call(`/event-categories/${id}`, { method: 'PATCH', cookie, body: json({ is_active: false }) });
    const list = (await (await call('/event-categories', { cookie })).json()) as any[];
    expect(list).toEqual([{ id, name: 'Air Limbah', color: P[0], is_active: false, event_count: 0 }]);
  });
  it('event_count counts only schedules that have not ended', async () => {
    const { cookie, user } = await login('Manager');
    const id = ((await (await make(cookie)).json()) as any).id;
    await addSchedule(user.id, id);
    await addSchedule(user.id, id, '2026-11-02');
    const list = (await (await call('/event-categories', { cookie })).json()) as any[];
    expect(list[0].event_count).toBe(1);
  });
});
