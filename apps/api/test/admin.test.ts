import { describe, it, expect } from 'vitest';
import { call, login, json } from './helpers';

describe('ponds', () => {
  it('operator cannot create', async () => {
    const { cookie } = await login('Operator');
    expect((await call('/ponds', { method: 'POST', cookie, body: json({ name: 'SP 1' }) })).status).toBe(403);
  });
  it('admin creates and lists', async () => {
    const { cookie } = await login('Admin');
    const res = await call('/ponds', { method: 'POST', cookie, body: json({ name: 'SP 1' }) });
    expect(res.status).toBe(201);
    const list = await (await call('/ponds', { cookie })).json() as any[];
    expect(list.map((p) => p.name)).toEqual(['SP 1']);
  });
  it('duplicate name is 409', async () => {
    const { cookie } = await login('Admin');
    await call('/ponds', { method: 'POST', cookie, body: json({ name: 'SP 1' }) });
    const res = await call('/ponds', { method: 'POST', cookie, body: json({ name: 'SP 1' }) });
    expect(res.status).toBe(409);
    expect((await res.json() as any).error).toBeTruthy();
  });
  it('blank name is 400', async () => {
    const { cookie } = await login('Admin');
    expect((await call('/ponds', { method: 'POST', cookie, body: json({ name: '  ' }) })).status).toBe(400);
  });
  it('inactive hidden by default, shown with all=1 for admin', async () => {
    const { cookie } = await login('Admin');
    const p = await (await call('/ponds', { method: 'POST', cookie, body: json({ name: 'SP 2' }) })).json() as any;
    await call(`/ponds/${p.id}`, { method: 'PATCH', cookie, body: json({ is_active: false }) });
    expect((await (await call('/ponds', { cookie })).json() as any[]).length).toBe(0);
    expect((await (await call('/ponds?all=1', { cookie })).json() as any[]).length).toBe(1);
  });
  it('all=1 lists switched-off ponds for any signed-in user', async () => {
    const admin = await login('Admin');
    const p = await (await call('/ponds', { method: 'POST', cookie: admin.cookie, body: json({ name: 'SP 3' }) })).json() as any;
    await call(`/ponds/${p.id}`, { method: 'PATCH', cookie: admin.cookie, body: json({ is_active: false }) });
    const op = await login('Operator');
    expect((await (await call('/ponds', { cookie: op.cookie })).json() as any[]).length).toBe(0);
    expect((await (await call('/ponds?all=1', { cookie: op.cookie })).json() as any[]).length).toBe(1);
  });
});

describe('pond details and thresholds', () => {
  const mk = (cookie: string, extra: object = {}) =>
    call('/ponds', { method: 'POST', cookie, body: json({ name: 'Pit Selatan', code: 'SP-02', latitude: -3.78421, longitude: 115.60214, thresholds: { ph_outlet: { min: 6, max: 9 }, tss_outlet: { min: null, max: 40 } }, ...extra }) });

  it('create with code, coordinates and thresholds, then list returns them', async () => {
    const { cookie } = await login('Admin');
    expect((await mk(cookie)).status).toBe(201);
    const [p] = await (await call('/ponds', { cookie })).json() as any[];
    expect(p).toMatchObject({ code: 'SP-02', name: 'Pit Selatan', latitude: -3.78421, longitude: 115.60214, is_active: true });
    expect(p.thresholds).toEqual({ ph_outlet: { min: 6, max: 9 }, tss_outlet: { min: null, max: 40 } });
  });
  it('pond without thresholds lists an empty object', async () => {
    const { cookie } = await login('Admin');
    await call('/ponds', { method: 'POST', cookie, body: json({ name: 'SP 1' }) });
    const [p] = await (await call('/ponds', { cookie })).json() as any[];
    expect(p.thresholds).toEqual({});
    expect(p.code).toBeNull();
  });
  it('patch changes one pond thresholds and leaves another alone', async () => {
    const { cookie } = await login('Admin');
    const a = await (await mk(cookie)).json() as any;
    const b = await (await mk(cookie, { name: 'Pit Utara', code: 'SP-01' })).json() as any;
    await call(`/ponds/${a.id}`, { method: 'PATCH', cookie, body: json({ thresholds: { ph_outlet: { min: 5.5, max: 9.5 } } }) });
    const list = await (await call('/ponds', { cookie })).json() as any[];
    expect(list.find((p) => p.id === a.id).thresholds.ph_outlet).toEqual({ min: 5.5, max: 9.5 });
    expect(list.find((p) => p.id === b.id).thresholds.ph_outlet).toEqual({ min: 6, max: 9 });
  });
  it('blank TSS maximum is stored as null', async () => {
    const { cookie } = await login('Admin');
    const a = await (await mk(cookie)).json() as any;
    await call(`/ponds/${a.id}`, { method: 'PATCH', cookie, body: json({ thresholds: { tss_outlet: { min: '', max: '' } } }) });
    const [p] = await (await call('/ponds', { cookie })).json() as any[];
    expect(p.thresholds.tss_outlet).toEqual({ min: null, max: null });
  });
  it('unknown threshold key is 400', async () => {
    const { cookie } = await login('Admin');
    expect((await mk(cookie, { thresholds: { ph_inlet: { min: 1, max: 2 } } })).status).toBe(400);
  });
  it('min above max is 400', async () => {
    const { cookie } = await login('Admin');
    expect((await mk(cookie, { thresholds: { ph_outlet: { min: 9, max: 6 } } })).status).toBe(400);
  });
  it('non-numeric bound is 400', async () => {
    const { cookie } = await login('Admin');
    expect((await mk(cookie, { thresholds: { ph_outlet: { min: 'x', max: 6 } } })).status).toBe(400);
  });
  it('latitude out of range is 400', async () => {
    const { cookie } = await login('Admin');
    expect((await mk(cookie, { latitude: 91 })).status).toBe(400);
  });
  it('duplicate code is 409', async () => {
    const { cookie } = await login('Admin');
    await mk(cookie);
    expect((await mk(cookie, { name: 'Lain' })).status).toBe(409);
  });
  it('operator cannot patch', async () => {
    const admin = await login('Admin');
    const a = await (await mk(admin.cookie)).json() as any;
    const op = await login('Operator');
    expect((await call(`/ponds/${a.id}`, { method: 'PATCH', cookie: op.cookie, body: json({ name: 'X' }) })).status).toBe(403);
  });
  it('old global thresholds route is gone', async () => {
    const { cookie } = await login('Admin');
    expect((await call('/thresholds', { cookie })).status).toBe(404);
  });
});

describe('users', () => {
  const body = { name: 'Budi', email: 'budi@x.id', password: 'secret-123', role: 'Operator' };
  it('create and list without password_hash', async () => {
    const { cookie } = await login('Admin');
    expect((await call('/users', { method: 'POST', cookie, body: json(body) })).status).toBe(201);
    const list = await (await call('/users', { cookie })).json() as any[];
    expect(list.find((u) => u.email === 'budi@x.id')).toBeTruthy();
    expect(JSON.stringify(list)).not.toContain('password_hash');
  });
  it('duplicate email is 409', async () => {
    const { cookie } = await login('Admin');
    await call('/users', { method: 'POST', cookie, body: json(body) });
    expect((await call('/users', { method: 'POST', cookie, body: json(body) })).status).toBe(409);
  });
  it('bad role is 400', async () => {
    const { cookie } = await login('Admin');
    expect((await call('/users', { method: 'POST', cookie, body: json({ ...body, role: 'King' }) })).status).toBe(400);
  });
  it('short password is 400', async () => {
    const { cookie } = await login('Admin');
    expect((await call('/users', { method: 'POST', cookie, body: json({ ...body, password: '123' }) })).status).toBe(400);
  });
  it('new user can sign in; password reset works', async () => {
    const { cookie } = await login('Admin');
    const u = await (await call('/users', { method: 'POST', cookie, body: json(body) })).json() as any;
    await call(`/users/${u.id}`, { method: 'PATCH', cookie, body: json({ password: 'brand-new-pw' }) });
    const ok = await call('/auth/login', { method: 'POST', body: json({ email: body.email, password: 'brand-new-pw' }) });
    expect(ok.status).toBe(200);
  });
  it('non-admin cannot list', async () => {
    const { cookie } = await login('Manager');
    expect((await call('/users', { cookie })).status).toBe(403);
  });
});
