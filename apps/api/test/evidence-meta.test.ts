import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { todayInSite } from '@evo/shared';
import { call, login } from './helpers';

const T = todayInSite();
const add = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const d = (n: number) => add(T, n);
const JPEG = () => { const u = new Uint8Array(64); u.set([0xff, 0xd8, 0xff, 0xe0]); return u; };

async function setup() {
  const op = await login('Operator');
  const sid = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO event_schedules (id,title,frequency,start_date,created_by,created_at) VALUES (?,?,?,?,?,?)')
    .bind(sid, 'Cek Saluran Inlet', 'Daily', d(-3), op.user.id, new Date().toISOString()).run();
  return { op, sid };
}
const send = (cookie: string, sid: string, fields: Record<string, string>) => {
  const f = new FormData();
  f.append('file', new File([JPEG()], 'foto.jpg', { type: 'image/jpeg' }));
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return call(`/events/${sid}/${d(0)}/evidence`, { method: 'POST', cookie, body: f });
};
const row = async (id: string) => env.DB.prepare('SELECT source,gps_lat,gps_lng,gps_accuracy,taken_at FROM evidences WHERE id = ?').bind(id).first<any>();
const errOf = async (r: Response) => ((await r.json()) as any).error as string;
const cam = (over: Record<string, string> = {}) => ({ source: 'camera', taken_at: new Date().toISOString(), gps_lat: '-3.78421', gps_lng: '115.60214', gps_accuracy: '12.5', ...over });
const without = (o: Record<string, string>, ...keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

describe('gallery uploads', () => {
  it('default to source gallery with no location or photo time', async () => {
    const { op, sid } = await setup();
    const res = await send(op.cookie, sid, {});
    expect(res.status).toBe(201);
    const out = (await res.json()) as any;
    expect(out).toMatchObject({ source: 'gallery', gps_lat: null, gps_lng: null, gps_accuracy: null, taken_at: null });
    expect(await row(out.id)).toEqual({ source: 'gallery', gps_lat: null, gps_lng: null, gps_accuracy: null, taken_at: null });
  });
  it('cannot carry a location or photo time: the fields are ignored', async () => {
    const { op, sid } = await setup();
    const out = (await (await send(op.cookie, sid, { source: 'gallery', gps_lat: '-3.7', gps_lng: '115.6', gps_accuracy: '5', taken_at: new Date().toISOString() })).json()) as any;
    expect(await row(out.id)).toEqual({ source: 'gallery', gps_lat: null, gps_lng: null, gps_accuracy: null, taken_at: null });
  });
});

describe('camera uploads', () => {
  it('store the location, accuracy and photo time exactly, and report them', async () => {
    const { op, sid } = await setup();
    const fields = cam();
    const res = await send(op.cookie, sid, fields);
    expect(res.status).toBe(201);
    const out = (await res.json()) as any;
    expect(out).toMatchObject({ source: 'camera', gps_lat: -3.78421, gps_lng: 115.60214, gps_accuracy: 12.5 });
    expect(new Date(out.taken_at).toISOString()).toBe(new Date(fields.taken_at).toISOString());
    const r = await row(out.id);
    expect(r).toMatchObject({ source: 'camera', gps_lat: -3.78421, gps_lng: 115.60214, gps_accuracy: 12.5 });
  });
  it('appear in the event detail with the same fields', async () => {
    const { op, sid } = await setup();
    await send(op.cookie, sid, cam());
    const detail = (await (await call(`/events/${sid}/${d(0)}`, { cookie: op.cookie })).json()) as any;
    expect(detail.evidences[0]).toMatchObject({ source: 'camera', gps_lat: -3.78421, gps_lng: 115.60214, gps_accuracy: 12.5 });
    expect(typeof detail.evidences[0].taken_at).toBe('string');
  });
  it('without a location are accepted and stored as "no location"', async () => {
    const { op, sid } = await setup();
    const res = await send(op.cookie, sid, without(cam(), 'gps_lat', 'gps_lng', 'gps_accuracy'));
    expect(res.status).toBe(201);
    const out = (await res.json()) as any;
    expect(out).toMatchObject({ source: 'camera', gps_lat: null, gps_lng: null, gps_accuracy: null });
  });
  it('need a photo time', async () => {
    const { op, sid } = await setup();
    const res = await send(op.cookie, sid, without(cam(), 'taken_at'));
    expect(res.status).toBe(400);
    expect(await errOf(res)).toBe('Waktu foto kamera wajib ada.');
  });
  it('refuse a photo time that is not a date, in the future, or too old', async () => {
    const { op, sid } = await setup();
    expect((await send(op.cookie, sid, cam({ taken_at: 'kemarin sore' }))).status).toBe(400);
    const future = await send(op.cookie, sid, cam({ taken_at: new Date(Date.now() + 10 * 60_000).toISOString() }));
    expect(future.status).toBe(400);
    expect(await errOf(future)).toBe('Waktu foto tidak boleh di masa depan.');
    const old = await send(op.cookie, sid, cam({ taken_at: new Date(Date.now() - 15 * 86_400_000).toISOString() }));
    expect(old.status).toBe(400);
    expect(await errOf(old)).toBe('Waktu foto terlalu lama.');
  });
  it('accept a clock a little ahead (under 5 minutes) and a photo from two weeks ago', async () => {
    const { op, sid } = await setup();
    expect((await send(op.cookie, sid, cam({ taken_at: new Date(Date.now() + 2 * 60_000).toISOString() }))).status).toBe(201);
    expect((await send(op.cookie, sid, cam({ taken_at: new Date(Date.now() - 13 * 86_400_000).toISOString() }))).status).toBe(201);
  });
  it('refuse coordinates outside the earth, with plain messages', async () => {
    const { op, sid } = await setup();
    const lat = await send(op.cookie, sid, cam({ gps_lat: '91' }));
    expect(lat.status).toBe(400);
    expect(await errOf(lat)).toBe('Lintang harus antara -90 dan 90.');
    const lng = await send(op.cookie, sid, cam({ gps_lng: '181' }));
    expect(lng.status).toBe(400);
    expect(await errOf(lng)).toBe('Bujur harus antara -180 dan 180.');
    expect((await send(op.cookie, sid, cam({ gps_lat: 'abc' }))).status).toBe(400);
    expect((await send(op.cookie, sid, cam({ gps_lng: 'NaN' }))).status).toBe(400);
    expect((await send(op.cookie, sid, cam({ gps_lat: 'Infinity' }))).status).toBe(400);
  });
  it('accept the exact edges of the globe', async () => {
    const { op, sid } = await setup();
    for (const [la, ln] of [['-90', '-180'], ['90', '180'], ['0', '0']]) {
      expect((await send(op.cookie, sid, cam({ gps_lat: la, gps_lng: ln, gps_accuracy: '0' }))).status).toBe(201);
    }
  });
  it('need latitude and longitude together', async () => {
    const { op, sid } = await setup();
    const onlyLat = await send(op.cookie, sid, without(cam(), 'gps_lng'));
    expect(onlyLat.status).toBe(400);
    expect(await errOf(onlyLat)).toBe('Lintang dan bujur harus dikirim berpasangan.');
    expect((await send(op.cookie, sid, without(cam(), 'gps_lat'))).status).toBe(400);
  });
  it('refuse an accuracy that is negative or absurd', async () => {
    const { op, sid } = await setup();
    expect((await send(op.cookie, sid, cam({ gps_accuracy: '-1' }))).status).toBe(400);
    expect((await send(op.cookie, sid, cam({ gps_accuracy: '100001' }))).status).toBe(400);
    expect((await send(op.cookie, sid, cam({ gps_accuracy: 'tinggi' }))).status).toBe(400);
  });
  it('ignore an accuracy that arrives with no coordinates', async () => {
    const { op, sid } = await setup();
    const out = (await (await send(op.cookie, sid, without(cam(), 'gps_lat', 'gps_lng'))).json()) as any;
    expect(out.gps_accuracy).toBeNull();
  });
});

describe('source', () => {
  it('only camera or gallery', async () => {
    const { op, sid } = await setup();
    const res = await send(op.cookie, sid, { source: 'drone' });
    expect(res.status).toBe(400);
    expect(await errOf(res)).toBe('Sumber foto tidak dikenal.');
  });
  it('a refused upload leaves nothing behind in the database or R2', async () => {
    const { op, sid } = await setup();
    const before = (await env.EVIDENCE.list()).objects.length;
    await send(op.cookie, sid, cam({ gps_lat: '91' }));
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM evidences').first<any>()).n).toBe(0);
    expect((await env.EVIDENCE.list()).objects).toHaveLength(before);
  });
});

describe('migration 0004 on existing rows', () => {
  it('rows from before are gallery with no location', async () => {
    const { op, sid } = await setup();
    await env.DB.prepare('INSERT INTO evidences (id,schedule_id,due_date,r2_key,filename,mime,size,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind('old1', sid, d(-1), 'k', 'lama.jpg', 'image/jpeg', 10, op.user.id, new Date().toISOString()).run();
    expect(await row('old1')).toEqual({ source: 'gallery', gps_lat: null, gps_lng: null, gps_accuracy: null, taken_at: null });
  });
});
