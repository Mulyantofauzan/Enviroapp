import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { todayInSite } from '@evo/shared';
import { addPond, call, login, json } from './helpers';

const body = (over: object = {}) => ({ title: 'Cek Saluran Inlet', frequency: 'Daily', start_date: '2026-11-01', ...over });
const create = (cookie: string, over: object = {}) => call('/schedules', { method: 'POST', cookie, body: json(body(over)) });
const errOf = async (r: Response) => ((await r.json()) as any).error as string;

describe('schedules: who can do what', () => {
  it.each(['Manager', 'Admin'] as const)('%s can create', async (role) => {
    const { cookie } = await login(role);
    const res = await create(cookie);
    expect(res.status).toBe(201);
    expect(typeof ((await res.json()) as any).id).toBe('string');
  });
  it.each(['Operator', 'Auditor'] as const)('%s cannot create', async (role) => {
    const { cookie } = await login(role);
    const res = await create(cookie);
    expect(res.status).toBe(403);
    expect(await errOf(res)).toBe('Hanya Manager atau Admin yang boleh mengatur jadwal.');
  });
  it('every signed-in role can list', async () => {
    const mgr = await login('Manager');
    await create(mgr.cookie);
    for (const role of ['Operator', 'Auditor', 'Admin'] as const) {
      const { cookie } = await login(role);
      const list = await (await call('/schedules', { cookie })).json() as any[];
      expect(list.map((s) => s.title)).toEqual(['Cek Saluran Inlet']);
    }
  });
  it('needs a session', async () => expect((await call('/schedules')).status).toBe(401));
});

describe('schedules: validation', () => {
  it('blank title is 400', async () => {
    const { cookie } = await login('Manager');
    expect((await create(cookie, { title: '  ' })).status).toBe(400);
  });
  it('unknown frequency is 400', async () => {
    const { cookie } = await login('Manager');
    expect((await create(cookie, { frequency: 'Hourly' })).status).toBe(400);
  });
  it('invalid start date is 400', async () => {
    const { cookie } = await login('Manager');
    expect((await create(cookie, { start_date: '2026-13-45' })).status).toBe(400);
  });
  it('unknown pond is 404', async () => {
    const { cookie } = await login('Manager');
    expect((await create(cookie, { sp_id: 'nope' })).status).toBe(404);
  });
  it('a known pond is accepted', async () => {
    const { cookie } = await login('Manager');
    const sp = await addPond();
    expect((await create(cookie, { sp_id: sp })).status).toBe(201);
  });
  it('assigned_to must be an existing active user', async () => {
    const { cookie } = await login('Manager');
    expect((await create(cookie, { assigned_to: 'ghost' })).status).toBe(400);
    const op = await login('Operator');
    expect((await create(cookie, { assigned_to: op.user.id })).status).toBe(201);
    await env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(op.user.id).run();
    expect((await create(cookie, { assigned_to: op.user.id })).status).toBe(400);
  });
});

describe('schedules: change and stop', () => {
  const mk = async () => {
    const { cookie, user } = await login('Manager');
    const id = ((await (await create(cookie)).json()) as any).id as string;
    return { cookie, user, id };
  };
  it('title can always be changed', async () => {
    const { cookie, id } = await mk();
    expect((await call(`/schedules/${id}`, { method: 'PATCH', cookie, body: json({ title: 'Baru' }) })).status).toBe(200);
    const [s] = await (await call('/schedules', { cookie })).json() as any[];
    expect(s.title).toBe('Baru');
    expect(s.locked).toBe(false);
  });
  it('frequency and start date can change while unlocked', async () => {
    const { cookie, id } = await mk();
    const res = await call(`/schedules/${id}`, { method: 'PATCH', cookie, body: json({ frequency: 'Weekly', start_date: '2026-11-02' }) });
    expect(res.status).toBe(200);
  });
  it('frequency and start date are locked once a completion exists', async () => {
    const { cookie, user, id } = await mk();
    await env.DB.prepare('INSERT INTO event_completions (schedule_id,due_date,completed_by,completed_at,completed_on) VALUES (?,?,?,?,?)')
      .bind(id, '2026-11-01', user.id, '2026-11-01T01:00:00Z', '2026-11-01').run();
    const res = await call(`/schedules/${id}`, { method: 'PATCH', cookie, body: json({ frequency: 'Weekly' }) });
    expect(res.status).toBe(409);
    expect(await errOf(res)).toBe('Frekuensi dan tanggal mulai tidak bisa diubah karena jadwal ini sudah punya catatan.');
    const [s] = await (await call('/schedules', { cookie })).json() as any[];
    expect(s.locked).toBe(true);
    // the same value is not a change
    expect((await call(`/schedules/${id}`, { method: 'PATCH', cookie, body: json({ frequency: 'Daily', title: 'Tetap' }) })).status).toBe(200);
  });
  it('locked also when evidence exists', async () => {
    const { cookie, user, id } = await mk();
    await env.DB.prepare('INSERT INTO evidences (id,schedule_id,due_date,r2_key,filename,mime,size,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind('e1', id, '2026-11-01', 'k', 'a.jpg', 'image/jpeg', 10, user.id, '2026-11-01T01:00:00Z').run();
    const [s] = await (await call('/schedules', { cookie })).json() as any[];
    expect(s.locked).toBe(true);
  });
  it('operator cannot patch', async () => {
    const { id } = await mk();
    const op = await login('Operator');
    expect((await call(`/schedules/${id}`, { method: 'PATCH', cookie: op.cookie, body: json({ title: 'X' }) })).status).toBe(403);
  });
  it('unknown id is 404', async () => {
    const { cookie } = await mk();
    expect((await call('/schedules/nope', { method: 'PATCH', cookie, body: json({ title: 'X' }) })).status).toBe(404);
  });
  it('stop sets ended_on to today (WITA) and hides it from the default list', async () => {
    const { cookie, id } = await mk();
    const res = await call(`/schedules/${id}/stop`, { method: 'POST', cookie });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).ended_on).toBe(todayInSite());
    expect(await (await call('/schedules', { cookie })).json()).toEqual([]);
    const all = await (await call('/schedules?all=1', { cookie })).json() as any[];
    expect(all[0].ended_on).toBe(todayInSite());
  });
  it('stopping twice is safe and keeps the first date', async () => {
    const { cookie, id } = await mk();
    await call(`/schedules/${id}/stop`, { method: 'POST', cookie });
    await env.DB.prepare('UPDATE event_schedules SET ended_on = ? WHERE id = ?').bind('2026-11-01', id).run();
    const res = await call(`/schedules/${id}/stop`, { method: 'POST', cookie });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).ended_on).toBe('2026-11-01');
  });
});

describe('GET /schedules/assignees', () => {
  it('lists active users by name for Manager and Admin, without emails or hashes', async () => {
    const mgr = await login('Manager');
    const op = await login('Operator');
    await env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind((await login('Auditor')).user.id).run();
    const res = await call('/schedules/assignees', { cookie: mgr.cookie });
    expect(res.status).toBe(200);
    const list = await res.json() as any[];
    expect(list.map((u) => u.name).sort()).toEqual(['Manager User', 'Operator User']);
    expect(Object.keys(list[0]).sort()).toEqual(['id', 'name']);
    expect(list.find((u) => u.name === 'Operator User').id).toBe(op.user.id);
    expect((await call('/schedules/assignees', { cookie: (await login('Admin')).cookie })).status).toBe(200);
  });
  it('Operator and Auditor cannot', async () => {
    expect((await call('/schedules/assignees', { cookie: (await login('Operator')).cookie })).status).toBe(403);
    expect((await call('/schedules/assignees', { cookie: (await login('Auditor')).cookie })).status).toBe(403);
  });
});
