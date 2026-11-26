import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { sendToUsers, type Sub, type Transport } from '../src/push/send';
import { addUser } from './helpers';

const msg = { title: 'T', body: 'B', url: '/', tag: 't' };
export async function subscribe(userId: string, endpoint: string) {
  await env.DB.prepare('INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth,created_at) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), userId, endpoint, 'k', 'a', '2026-11-23').run();
}
const recorder = (status: (s: Sub) => number = () => 201) => {
  const calls: string[] = [];
  const t: Transport = async (s) => { calls.push(s.endpoint); return status(s); };
  return { calls, t };
};

describe('sendToUsers', () => {
  it('sends to every device of the user', async () => {
    const u = await addUser('Admin');
    await subscribe(u.id, 'https://p/1'); await subscribe(u.id, 'https://p/2');
    const r = recorder();
    expect(await sendToUsers(env, [u.id], msg, null, r.t)).toBe(2);
    expect(r.calls.sort()).toEqual(['https://p/1', 'https://p/2']);
  });
  it('skips a dedup key that was already used', async () => {
    const u = await addUser('Admin');
    await subscribe(u.id, 'https://p/1');
    const r = recorder();
    await sendToUsers(env, [u.id], msg, (id) => `k|${id}`, r.t);
    await sendToUsers(env, [u.id], msg, (id) => `k|${id}`, r.t);
    expect(r.calls).toHaveLength(1);
  });
  it('removes a device the push service rejects with 410 and still sends to the others', async () => {
    const u = await addUser('Admin');
    await subscribe(u.id, 'https://p/dead'); await subscribe(u.id, 'https://p/ok');
    const r = recorder((s) => (s.endpoint.endsWith('dead') ? 410 : 201));
    expect(await sendToUsers(env, [u.id], msg, null, r.t)).toBe(1);
    const left = (await env.DB.prepare('SELECT endpoint FROM push_subscriptions').all<any>()).results.map((x) => x.endpoint);
    expect(left).toEqual(['https://p/ok']);
  });
  it('does nothing and logs nothing for a user without devices', async () => {
    const u = await addUser('Admin');
    const r = recorder();
    expect(await sendToUsers(env, [u.id], msg, (id) => `k|${id}`, r.t)).toBe(0);
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM notification_log').first<any>()).n).toBe(0);
  });
});

describe('defaultTransport', () => {
  it('builds an encrypted, VAPID-signed request for a real subscription key', async () => {
    const { defaultTransport } = await import('../src/push/send');
    const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const dev = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const jwk = await crypto.subtle.exportKey('jwk', vapid.privateKey);
    const e = { ...env, VAPID_PUBLIC_KEY: b64u(await crypto.subtle.exportKey('raw', vapid.publicKey)), VAPID_PRIVATE_KEY: jwk.d, VAPID_SUBJECT: 'mailto:a@b.id' } as any;
    const seen: { url: string; init: RequestInit }[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return new Response(null, { status: 201 }); }) as any;
    try {
      const status = await defaultTransport(
        { endpoint: 'https://push.example/x', p256dh: b64u(await crypto.subtle.exportKey('raw', dev.publicKey)), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) },
        msg, e,
      );
      expect(status).toBe(201);
    } finally { globalThis.fetch = real; }
    expect(seen[0].url).toBe('https://push.example/x');
    const h = new Headers(seen[0].init.headers);
    expect(h.get('content-encoding')).toBe('aes128gcm');
    expect(h.get('authorization')).toMatch(/^vapid /);
  });
  it('returns 0 when no key is configured', async () => {
    const { defaultTransport } = await import('../src/push/send');
    expect(await defaultTransport({ endpoint: 'https://p/x', p256dh: 'a', auth: 'b' }, msg, { ...env, VAPID_PRIVATE_KEY: undefined } as any)).toBe(0);
  });
});
