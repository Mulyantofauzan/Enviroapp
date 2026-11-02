import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { todayInSite } from '@evo/shared';
import { addPond, call, login } from './helpers';
import { app } from '../src/index';

const T = todayInSite();
const add = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const d = (n: number) => add(T, n);

async function schedule(by: string, title: string, over: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO event_schedules (id,title,frequency,start_date,sp_id,ended_on,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, title, 'Daily', d(-400), over.sp_id ?? null, over.ended_on ?? null, by, new Date().toISOString()).run();
  return id;
}
let n = 0;
async function ev(sid: string, due: string, by: string, over: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  const at = over.uploaded_at ?? new Date(Date.UTC(2026, 10, 1, 0, 0, n++)).toISOString();
  await env.DB.prepare('INSERT INTO evidences (id,schedule_id,due_date,r2_key,filename,mime,size,uploaded_by,uploaded_at,source,gps_lat,gps_lng,gps_accuracy,taken_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, sid, due, `k/${id}`, over.filename ?? 'foto.jpg', over.mime ?? 'image/jpeg', 1000, by, at, over.source ?? 'gallery', over.lat ?? null, over.lng ?? null, over.acc ?? null, over.taken ?? null).run();
  return id;
}
const q = (cookie: string, s: string) => call(`/evidence?${s}`, { cookie });
const range = (a = -30, b = 0) => `from=${d(a)}&to=${d(b)}`;
const json = async (r: Response) => (await r.json()) as any;

describe('GET /evidence validation', () => {
  it('needs both dates, valid, in order', async () => {
    const { cookie } = await login('Auditor');
    expect((await q(cookie, '')).status).toBe(400);
    expect((await q(cookie, `from=${d(-1)}`)).status).toBe(400);
    expect((await q(cookie, 'from=abc&to=def')).status).toBe(400);
    expect((await q(cookie, `from=${d(0)}&to=${d(-1)}`)).status).toBe(400);
  });
  it('accepts a range of 366 days, refuses 367', async () => {
    const { cookie } = await login('Auditor');
    expect((await q(cookie, `from=${d(-366)}&to=${d(0)}`)).status).toBe(200);
    const bad = await q(cookie, `from=${d(-367)}&to=${d(0)}`);
    expect(bad.status).toBe(400);
    expect((await json(bad)).error).toBe('Pilih rentang satu tahun atau kurang.');
  });
  it('limit: default 50, capped at 100, and zero, negative or text are refused', async () => {
    const { cookie, user } = await login('Operator');
    const sid = await schedule(user.id, 'Cek');
    for (let i = 0; i < 120; i++) await ev(sid, d(-(i % 20)), user.id);
    expect((await json(await q(cookie, range()))).items).toHaveLength(50);
    expect((await json(await q(cookie, `${range()}&limit=1000`))).items).toHaveLength(100);
    expect((await q(cookie, `${range()}&limit=0`)).status).toBe(400);
    expect((await q(cookie, `${range()}&limit=-5`)).status).toBe(400);
    expect((await q(cookie, `${range()}&limit=banyak`)).status).toBe(400);
    expect((await q(cookie, `${range()}&offset=-1`)).status).toBe(400);
  });
});

describe('GET /evidence results', () => {
  it('carries what an auditor needs about each file', async () => {
    const op = await login('Operator');
    const aud = await login('Auditor');
    const sid = await schedule(op.user.id, 'Cek Saluran Inlet');
    await ev(sid, d(-1), op.user.id, { source: 'camera', lat: -3.78421, lng: 115.60214, acc: 12.5, taken: '2026-11-01T00:21:00.000Z', filename: 'inlet.jpg' });
    const r = await json(await q(aud.cookie, range()));
    expect(r.total).toBe(1);
    expect(r.items[0]).toMatchObject({
      filename: 'inlet.jpg', mime: 'image/jpeg', size: 1000, source: 'camera', gps_lat: -3.78421, gps_lng: 115.60214, gps_accuracy: 12.5,
      taken_at: '2026-11-01T00:21:00.000Z', title: 'Cek Saluran Inlet', due_date: d(-1), uploaded_by_name: 'Operator User', uploaded_by_role: 'Operator', schedule_id: sid, sp_id: null,
    });
    expect(typeof r.items[0].id).toBe('string');
    expect(typeof r.items[0].uploaded_at).toBe('string');
  });
  it('is newest event first, then newest upload', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, 'Cek');
    const a = await ev(sid, d(-3), op.user.id);
    const b = await ev(sid, d(-1), op.user.id);
    const c = await ev(sid, d(-1), op.user.id);
    const r = await json(await q(op.cookie, range()));
    expect(r.items.map((x: any) => x.id)).toEqual([c, b, a]);
  });
  it('only returns evidence whose event date is inside the range', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, 'Cek');
    await ev(sid, d(-40), op.user.id);
    const inside = await ev(sid, d(-5), op.user.id);
    const r = await json(await q(op.cookie, range(-30, 0)));
    expect(r.items.map((x: any) => x.id)).toEqual([inside]);
    expect(r.total).toBe(1);
  });
  it('filters by schedule', async () => {
    const op = await login('Operator');
    const s1 = await schedule(op.user.id, 'Cek');
    const s2 = await schedule(op.user.id, 'Uji Air');
    await ev(s1, d(-1), op.user.id);
    const keep = await ev(s2, d(-1), op.user.id);
    const r = await json(await q(op.cookie, `${range()}&schedule=${s2}`));
    expect(r.items.map((x: any) => x.id)).toEqual([keep]);
  });
  it('filters by pond, and always includes pond-less schedules', async () => {
    const op = await login('Operator');
    const a = await addPond('A');
    const b = await addPond('B');
    const sa = await schedule(op.user.id, 'Hanya A', { sp_id: a });
    const sb = await schedule(op.user.id, 'Hanya B', { sp_id: b });
    const sn = await schedule(op.user.id, 'Semua');
    await ev(sa, d(-1), op.user.id); await ev(sb, d(-1), op.user.id); await ev(sn, d(-1), op.user.id);
    const r = await json(await q(op.cookie, `${range()}&sp=${a}`));
    expect(r.items.map((x: any) => x.title).sort()).toEqual(['Hanya A', 'Semua']);
  });
  it('total does not depend on limit or offset, and an offset past the end is simply empty', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, 'Cek');
    for (let i = 0; i < 7; i++) await ev(sid, d(-i), op.user.id);
    const page = await json(await q(op.cookie, `${range()}&limit=3&offset=3`));
    expect(page.total).toBe(7);
    expect(page.items).toHaveLength(3);
    const past = await json(await q(op.cookie, `${range()}&limit=3&offset=100`));
    expect(past.total).toBe(7);
    expect(past.items).toEqual([]);
  });
  it('pages do not overlap', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, 'Cek');
    for (let i = 0; i < 7; i++) await ev(sid, d(-i), op.user.id);
    const p1 = (await json(await q(op.cookie, `${range()}&limit=4&offset=0`))).items.map((x: any) => x.id);
    const p2 = (await json(await q(op.cookie, `${range()}&limit=4&offset=4`))).items.map((x: any) => x.id);
    expect(new Set([...p1, ...p2]).size).toBe(7);
  });
  it('still lists evidence of a schedule that was stopped', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, 'Berhenti', { ended_on: d(-3) });
    await ev(sid, d(-5), op.user.id);
    expect((await json(await q(op.cookie, range()))).total).toBe(1);
  });
});

describe('GET /evidence access and cost', () => {
  it.each(['Auditor', 'Manager', 'Operator', 'Admin'] as const)('%s can read', async (role) => {
    const { cookie } = await login(role);
    expect((await q(cookie, range())).status).toBe(200);
  });
  it('needs a session', async () => expect((await q('', range())).status).toBe(401));
  it('uses few queries however many rows there are', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, 'Cek');
    for (let i = 0; i < 30; i++) await ev(sid, d(-(i % 10)), op.user.id);
    let queries = 0;
    const counting = new Proxy(env.DB, {
      get(t, p) {
        if (p === 'prepare') return (sql: string) => { queries++; return t.prepare(sql); };
        const v = (t as any)[p];
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    const res = await app.request(`/api/evidence?${range()}`, { headers: { cookie: op.cookie } }, { DB: counting, EVIDENCE: env.EVIDENCE });
    expect(res.status).toBe(200);
    expect(queries).toBeLessThanOrEqual(4);
  });
  it('the single-file download route still works next to the list', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, 'Cek');
    const id = await ev(sid, d(-1), op.user.id);
    await env.EVIDENCE.put(`k/${id}`, new Uint8Array([0xff, 0xd8, 0xff]), { httpMetadata: { contentType: 'image/jpeg' } });
    expect((await call(`/evidence/${id}/file`, { cookie: op.cookie })).status).toBe(200);
  });
});
