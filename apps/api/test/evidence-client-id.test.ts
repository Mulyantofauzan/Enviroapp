import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { todayInSite } from '@evo/shared';
import { addUser, call, login } from './helpers';

const T = todayInSite();
const day = (n: number) => new Date(Date.parse(`${T}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const JPEG = () => { const u = new Uint8Array(64); u.set([0xff, 0xd8, 0xff, 0xe0]); return u; };

async function schedule(by: string) {
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO event_schedules (id,title,frequency,start_date,created_by,created_at) VALUES (?,?,?,?,?,?)')
    .bind(id, 'Cek Saluran Inlet', 'Daily', day(-3), by, new Date().toISOString()).run();
  return id;
}
const form = (clientId?: string) => {
  const f = new FormData();
  f.append('file', new File([JPEG()], 'foto.jpg', { type: 'image/jpeg' }));
  f.append('source', 'gallery');
  if (clientId !== undefined) f.append('client_id', clientId);
  return f;
};
const upload = (cookie: string, sid: string, f: FormData) => call(`/events/${sid}/${day(-1)}/evidence`, { method: 'POST', cookie, body: f });
const rows = async (sid: string) => (await env.DB.prepare('SELECT COUNT(*) n FROM evidences WHERE schedule_id = ?').bind(sid).first<any>()).n as number;
const r2Count = async () => (await env.EVIDENCE.list()).objects.length;

describe('evidence client_id', () => {
  it('the same client_id twice gives 201 then 200, the same id, one row and one R2 object', async () => {
    const op = await login('Operator'); const sid = await schedule(op.user.id);
    const before = await r2Count();
    const a = await upload(op.cookie, sid, form('11111111-aaaa'));
    const b = await upload(op.cookie, sid, form('11111111-aaaa'));
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(((await b.json()) as any).id).toBe(((await a.json()) as any).id);
    expect(await rows(sid)).toBe(1);
    expect(await r2Count() - before).toBe(1);
  });
  it('without client_id every upload is a new row', async () => {
    const op = await login('Operator'); const sid = await schedule(op.user.id);
    await upload(op.cookie, sid, form());
    await upload(op.cookie, sid, form());
    expect(await rows(sid)).toBe(2);
  });
  it('a malformed client_id is 400', async () => {
    const op = await login('Operator'); const sid = await schedule(op.user.id);
    const res = await upload(op.cookie, sid, form('x'));
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe('ID unggahan tidak sah.');
  });
  it("another user's client_id is 409", async () => {
    const a = await login('Operator'); const sid = await schedule(a.user.id);
    await upload(a.cookie, sid, form('22222222-bbbb'));
    const u2 = await addUser('Operator', 'op2@x.id');
    const c2 = (await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: u2.email, password: u2.password }) })).headers.get('set-cookie')!.split(';')[0];
    const res = await upload(c2, sid, form('22222222-bbbb'));
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error).toBe('ID unggahan sudah dipakai.');
  });
  it('two simultaneous uploads with one client_id leave one row', async () => {
    const op = await login('Operator'); const sid = await schedule(op.user.id);
    const before = await r2Count();
    const [x, y] = await Promise.all([upload(op.cookie, sid, form('33333333-cccc')), upload(op.cookie, sid, form('33333333-cccc'))]);
    expect([x.status, y.status].every((s) => s === 200 || s === 201)).toBe(true);
    expect(await rows(sid)).toBe(1);
    expect(await r2Count() - before).toBe(1);
  });
});

describe('complete twice', () => {
  it('200 then 409 "Event ini sudah selesai." and a single completion', async () => {
    const op = await login('Operator'); const sid = await schedule(op.user.id);
    await upload(op.cookie, sid, form());
    const path = `/events/${sid}/${day(-1)}/complete`;
    expect((await call(path, { method: 'POST', cookie: op.cookie })).status).toBe(200);
    const second = await call(path, { method: 'POST', cookie: op.cookie });
    expect(second.status).toBe(409);
    expect(((await second.json()) as any).error).toBe('Event ini sudah selesai.');
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM event_completions').first<any>()).n).toBe(1);
  });
});
