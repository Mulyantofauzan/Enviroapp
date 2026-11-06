import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { todayInSite } from '@evo/shared';
import { addPond, call, login } from './helpers';
import { app } from '../src/index';

const T = todayInSite();
const add = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const d = (n: number) => add(T, n);

async function schedule(by: string, over: Record<string, unknown> = {}) {
  const s = { id: crypto.randomUUID(), title: 'Cek Saluran Inlet', description: 'Periksa saluran', frequency: 'Daily', start_date: d(-3), sp_id: null, category_id: null, assigned_to: null, ended_on: null, ...over };
  await env.DB.prepare('INSERT INTO event_schedules (id,title,description,frequency,start_date,sp_id,category_id,assigned_to,ended_on,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(s.id, s.title, s.description, s.frequency, s.start_date, s.sp_id, s.category_id, s.assigned_to, s.ended_on, by, new Date().toISOString()).run();
  return s;
}
const complete = (sid: string, due: string, by: string, on = due) =>
  env.DB.prepare('INSERT INTO event_completions (schedule_id,due_date,completed_by,completed_at,completed_on) VALUES (?,?,?,?,?)').bind(sid, due, by, `${on}T02:00:00Z`, on).run();
const evidence = (sid: string, due: string, by: string) =>
  env.DB.prepare('INSERT INTO evidences (id,schedule_id,due_date,r2_key,filename,mime,size,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), sid, due, 'k', 'foto.jpg', 'image/jpeg', 1000, by, new Date().toISOString()).run();
const list = async (cookie: string, q: string) => (await (await call(`/events?${q}`, { cookie })).json()) as any;

describe('GET /events: category', () => {
  const category = async (name: string, color: string) => {
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO event_categories (id,name,color,created_at) VALUES (?,?,?,?)').bind(id, name, color, new Date().toISOString()).run();
    return id;
  };
  it('every occurrence carries its category, or three nulls without one', async () => {
    const { cookie, user } = await login('Manager');
    const k = await category('Air', '#2E7D32');
    await schedule(user.id, { title: 'Dengan', category_id: k, start_date: d(0) });
    await schedule(user.id, { title: 'Tanpa', start_date: d(0) });
    const r = await list(cookie, `from=${d(0)}&to=${d(0)}`);
    const by = Object.fromEntries(r.events.map((e: any) => [e.title, e]));
    expect(by['Dengan']).toMatchObject({ category_id: k, category_name: 'Air', category_color: '#2E7D32' });
    expect(by['Tanpa']).toMatchObject({ category_id: null, category_name: null, category_color: null });
  });
  it('overdue and the day detail carry it too', async () => {
    const { cookie, user } = await login('Manager');
    const k = await category('Air', '#2E7D32');
    const s = await schedule(user.id, { category_id: k, start_date: d(-2) });
    const o = (await (await call('/events/overdue', { cookie })).json()) as any;
    expect(o.events[0].category_name).toBe('Air');
    const one = (await (await call(`/events/${s.id}/${d(-1)}`, { cookie })).json()) as any;
    expect(one.event.category_color).toBe('#2E7D32');
  });
});

describe('GET /events', () => {
  it('rejects a range longer than 62 days, bad dates, and missing dates', async () => {
    const { cookie } = await login('Manager');
    expect((await call(`/events?from=${d(-70)}&to=${d(0)}`, { cookie })).status).toBe(400);
    expect((await call('/events?from=abc&to=def', { cookie })).status).toBe(400);
    expect((await call('/events', { cookie })).status).toBe(400);
    expect((await call(`/events?from=${d(0)}&to=${d(-1)}`, { cookie })).status).toBe(400);
  });
  it('returns today from the server and the days in range with correct status', async () => {
    const { cookie, user } = await login('Manager');
    await schedule(user.id);
    const r = await list(cookie, `from=${d(-3)}&to=${d(1)}`);
    expect(r.today).toBe(T);
    expect(r.events.map((e: any) => [e.due_date, e.status])).toEqual([
      [d(-3), 'overdue'], [d(-2), 'overdue'], [d(-1), 'overdue'], [d(0), 'today'], [d(1), 'upcoming'],
    ]);
  });
  it('weekly appears only on its own weekday', async () => {
    const { cookie, user } = await login('Manager');
    await schedule(user.id, { frequency: 'Weekly', start_date: d(-14) });
    const r = await list(cookie, `from=${d(-14)}&to=${d(0)}`);
    expect(r.events.map((e: any) => e.due_date)).toEqual([d(-14), d(-7), d(0)]);
  });
  it('a completed day is done, on-time or late', async () => {
    const { cookie, user } = await login('Manager');
    const s = await schedule(user.id);
    await complete(s.id, d(-2), user.id, d(-2));
    await complete(s.id, d(-1), user.id, d(0));
    const r = await list(cookie, `from=${d(-3)}&to=${d(0)}`);
    const by = Object.fromEntries(r.events.map((e: any) => [e.due_date, e]));
    expect(by[d(-2)]).toMatchObject({ status: 'done', late: false, completed_by_name: 'Manager User' });
    expect(by[d(-1)]).toMatchObject({ status: 'done', late: true });
    expect(by[d(-3)]).toMatchObject({ status: 'overdue', late: false, completed_at: null });
  });
  it('counts evidence per day', async () => {
    const { cookie, user } = await login('Manager');
    const s = await schedule(user.id);
    await evidence(s.id, d(-1), user.id);
    await evidence(s.id, d(-1), user.id);
    const r = await list(cookie, `from=${d(-1)}&to=${d(0)}`);
    expect(r.events.map((e: any) => e.evidence_count)).toEqual([2, 0]);
  });
  it('filters by frequency; a pond id on an old row never hides an event and ?sp= is ignored', async () => {
    const { cookie, user } = await login('Manager');
    const a = await addPond('A');
    const b = await addPond('B');
    await schedule(user.id, { title: 'Harian A', sp_id: a, start_date: d(0) });
    await schedule(user.id, { title: 'Harian B', sp_id: b, start_date: d(0) });
    await schedule(user.id, { title: 'Semua', start_date: d(0) });
    await schedule(user.id, { title: 'Mingguan A', frequency: 'Weekly', sp_id: a, start_date: d(0) });
    const forA = await list(cookie, `from=${d(0)}&to=${d(0)}&sp=${a}`);
    expect(forA.events.map((e: any) => e.title).sort()).toEqual(['Harian A', 'Harian B', 'Mingguan A', 'Semua']);
    expect(forA.events[0]).not.toHaveProperty('sp_id');
    const weekly = await list(cookie, `from=${d(0)}&to=${d(0)}&frequency=Weekly`);
    expect(weekly.events.map((e: any) => e.title)).toEqual(['Mingguan A']);
    expect((await call(`/events?from=${d(0)}&to=${d(0)}&frequency=Hourly`, { cookie })).status).toBe(400);
  });
  it('a stopped schedule has no days after it ended but keeps earlier overdue', async () => {
    const { cookie, user } = await login('Manager');
    await schedule(user.id, { start_date: d(-5), ended_on: d(-3) });
    const r = await list(cookie, `from=${d(-5)}&to=${d(0)}`);
    expect(r.events.map((e: any) => e.due_date)).toEqual([d(-5), d(-4), d(-3)]);
    expect(r.events.every((e: any) => e.status === 'overdue')).toBe(true);
  });
  it.each(['Auditor', 'Manager', 'Operator', 'Admin'] as const)('%s can read', async (role) => {
    const { cookie } = await login(role);
    expect((await call(`/events?from=${d(0)}&to=${d(0)}`, { cookie })).status).toBe(200);
  });
  it('needs a session', async () => expect((await call(`/events?from=${d(0)}&to=${d(0)}`)).status).toBe(401));
  it('uses a small fixed number of queries for 20 schedules', async () => {
    const { cookie, user } = await login('Manager');
    for (let i = 0; i < 20; i++) await schedule(user.id, { title: `J${i}` });
    let q = 0;
    const counting = new Proxy(env.DB, {
      get(t, p) {
        if (p === 'prepare') return (sql: string) => { q++; return t.prepare(sql); };
        const v = (t as any)[p];
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    const res = await app.request(`/api/events?from=${d(-6)}&to=${d(0)}`, { headers: { cookie } }, { DB: counting, EVIDENCE: env.EVIDENCE });
    expect(res.status).toBe(200);
    expect(q).toBeLessThanOrEqual(6);
  });
});

describe('GET /events/overdue and /events/summary', () => {
  it('lists newest first, caps at 200, and reports the true total', async () => {
    const { cookie, user } = await login('Manager');
    await schedule(user.id, { start_date: d(-250) });
    const r = (await (await call('/events/overdue', { cookie })).json()) as any;
    expect(r.total).toBe(250);
    expect(r.events).toHaveLength(200);
    expect(r.events[0].due_date).toBe(d(-1));
    expect(r.events[199].due_date).toBe(d(-200));
    expect(r.events.every((e: any) => e.status === 'overdue')).toBe(true);
  });
  it('completed days are not overdue', async () => {
    const { cookie, user } = await login('Manager');
    const s = await schedule(user.id, { start_date: d(-3) });
    await complete(s.id, d(-2), user.id);
    const r = (await (await call('/events/overdue', { cookie })).json()) as any;
    expect(r.events.map((e: any) => e.due_date)).toEqual([d(-1), d(-3)]);
  });
  it('a schedule starting today has no overdue yet', async () => {
    const { cookie, user } = await login('Manager');
    await schedule(user.id, { start_date: d(0) });
    expect(((await (await call('/events/overdue', { cookie })).json()) as any).total).toBe(0);
  });
  it('filters overdue by frequency; ?sp= is ignored', async () => {
    const { cookie, user } = await login('Manager');
    const a = await addPond('A');
    await schedule(user.id, { title: 'Harian', start_date: d(-2), sp_id: a });
    await schedule(user.id, { title: 'Mingguan', frequency: 'Weekly', start_date: d(-7) });
    const w = (await (await call('/events/overdue?frequency=Weekly', { cookie })).json()) as any;
    expect(w.events.map((e: any) => e.title)).toEqual(['Mingguan']);
    const p = (await (await call(`/events/overdue?sp=${a}`, { cookie })).json()) as any;
    expect(p.events.map((e: any) => e.title)).toEqual(['Harian', 'Harian', 'Mingguan']);
    expect(p.events[0]).not.toHaveProperty('sp_id');
  });
  it('summary agrees with the overdue total and counts what is due today', async () => {
    const { cookie, user } = await login('Operator');
    const s = await schedule(user.id, { start_date: d(-250) });
    await schedule(user.id, { title: 'Mingguan', frequency: 'Weekly', start_date: d(0) });
    await complete(s.id, d(0), user.id);
    const r = (await (await call('/events/summary', { cookie })).json()) as any;
    expect(r).toEqual({ today: T, overdue: 250, due_today: 1 });
  });
});

describe('GET /events/:scheduleId/:date', () => {
  it('returns the event and its evidences', async () => {
    const { cookie, user } = await login('Operator');
    const s = await schedule(user.id, { description: 'Periksa kebersihan' });
    await evidence(s.id, d(-1), user.id);
    const r = (await (await call(`/events/${s.id}/${d(-1)}`, { cookie })).json()) as any;
    expect(r.today).toBe(T);
    expect(r.event).toMatchObject({ schedule_id: s.id, title: 'Cek Saluran Inlet', description: 'Periksa kebersihan', due_date: d(-1), status: 'overdue', evidence_count: 1 });
    expect(r.evidences).toHaveLength(1);
    expect(r.evidences[0]).toMatchObject({ filename: 'foto.jpg', mime: 'image/jpeg', size: 1000, uploaded_by_name: 'Operator User' });
  });
  it('a date that is not a due date is 404', async () => {
    const { cookie, user } = await login('Operator');
    const s = await schedule(user.id, { frequency: 'Weekly', start_date: d(-14) });
    const res = await call(`/events/${s.id}/${d(-10)}`, { cookie });
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).error).toBe('Event tidak ditemukan.');
  });
  it('unknown schedule and bad date', async () => {
    const { cookie } = await login('Operator');
    expect((await call(`/events/nope/${d(0)}`, { cookie })).status).toBe(404);
    expect((await call('/events/nope/abc', { cookie })).status).toBe(400);
  });
});

describe('GET /events/summary reads little', () => {
  it('counts completions in SQL instead of reading and joining the whole history', async () => {
    const { cookie, user } = await login('Manager');
    const s = await schedule(user.id, { start_date: d(-30) });
    for (let i = 1; i <= 10; i++) await complete(s.id, d(-i), user.id);
    const seen: string[] = [];
    const spying = new Proxy(env.DB, {
      get(t, p) {
        if (p === 'prepare') return (sql: string) => { seen.push(sql); return t.prepare(sql); };
        const v = (t as any)[p];
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    const res = await app.request('/api/events/summary', { headers: { cookie } }, { DB: spying, EVIDENCE: env.EVIDENCE });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).overdue).toBe(20);
    expect(seen.some((q) => /COUNT\(\*\)[^;]*event_completions/i.test(q))).toBe(true);
    expect(seen.some((q) => /event_completions/i.test(q) && /JOIN users/i.test(q))).toBe(false);
  });
});
