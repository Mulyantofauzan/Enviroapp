import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { addUser, call, login, json } from './helpers';
import { hashPassword, verifyPassword } from '../src/auth/password';

describe('password', () => {
  it('rejects a different password', async () => {
    const h = await hashPassword('right');
    expect(await verifyPassword('right', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });
  it('salts: two hashes of one password differ', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
});

describe('auth routes', () => {
  it('login ok sets HttpOnly cookie', async () => {
    const u = await addUser('Operator');
    const res = await call('/auth/login', { method: 'POST', body: json({ email: u.email, password: u.password }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('HttpOnly');
  });
  it('wrong password returns 401 with plain error', async () => {
    const u = await addUser('Operator');
    const res = await call('/auth/login', { method: 'POST', body: json({ email: u.email, password: 'nope' }) });
    expect(res.status).toBe(401);
    expect((await res.json() as any).error).toBe('Wrong email or password.');
  });
  it('unknown email returns the same 401', async () => {
    const res = await call('/auth/login', { method: 'POST', body: json({ email: 'ghost@x.id', password: 'x' }) });
    expect(res.status).toBe(401);
  });
  it('me without cookie is 401', async () => {
    expect((await call('/auth/me')).status).toBe(401);
  });
  it('me with cookie returns name and role', async () => {
    const { cookie } = await login('Operator');
    const res = await call('/auth/me', { cookie });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: 'Operator User', role: 'Operator' });
  });
  it('logout ends the session', async () => {
    const { cookie } = await login('Operator');
    await call('/auth/logout', { method: 'POST', cookie });
    expect((await call('/auth/me', { cookie })).status).toBe(401);
  });
  it('expired session is 401', async () => {
    const { cookie } = await login('Operator');
    await env.DB.prepare('UPDATE sessions SET expires_at = 1').run();
    expect((await call('/auth/me', { cookie })).status).toBe(401);
  });
});
