import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { call, json, login } from './helpers';

const sub = (endpoint = 'https://push.example/abc') => json({ endpoint, keys: { p256dh: 'pk', auth: 'au' } });
const rows = async () => (await env.DB.prepare('SELECT endpoint, user_id FROM push_subscriptions').all<any>()).results;

describe('push routes', () => {
  it('require login', async () => {
    expect((await call('/push/subscribe', { method: 'POST', body: sub() })).status).toBe(401);
    expect((await call('/push/key')).status).toBe(401);
  });
  it('subscribing twice with the same endpoint keeps one row', async () => {
    const { cookie } = await login('Operator');
    await call('/push/subscribe', { method: 'POST', body: sub(), cookie });
    await call('/push/subscribe', { method: 'POST', body: sub(), cookie });
    expect(await rows()).toHaveLength(1);
  });
  it('moves an endpoint to whoever signs in on that device next', async () => {
    const a = await login('Operator');
    await call('/push/subscribe', { method: 'POST', body: sub(), cookie: a.cookie });
    const b = await login('Admin');
    await call('/push/subscribe', { method: 'POST', body: sub(), cookie: b.cookie });
    expect(await rows()).toEqual([{ endpoint: 'https://push.example/abc', user_id: b.user.id }]);
  });
  it('rejects a malformed subscription', async () => {
    const { cookie } = await login('Operator');
    expect((await call('/push/subscribe', { method: 'POST', body: json({ endpoint: 'http://x' }), cookie })).status).toBe(400);
  });
  it('deletes only the caller\'s own subscription', async () => {
    const a = await login('Operator');
    const b = await login('Admin');
    await call('/push/subscribe', { method: 'POST', body: sub(), cookie: a.cookie });
    await call('/push/subscribe', { method: 'DELETE', body: json({ endpoint: 'https://push.example/abc' }), cookie: b.cookie });
    expect(await rows()).toHaveLength(1);
    await call('/push/subscribe', { method: 'DELETE', body: json({ endpoint: 'https://push.example/abc' }), cookie: a.cookie });
    expect(await rows()).toHaveLength(0);
  });
  it('GET /push/key returns the public key when configured', async () => {
    const { cookie } = await login('Operator');
    const was = env.VAPID_PUBLIC_KEY;
    (env as any).VAPID_PUBLIC_KEY = 'PUB';
    const res = await call('/push/key', { cookie });
    (env as any).VAPID_PUBLIC_KEY = was;
    expect(await res.json()).toEqual({ key: 'PUB' });
  });
});
