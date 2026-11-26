import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { Env } from '../types';
import type { Msg } from './select';

export type Sub = { endpoint: string; p256dh: string; auth: string };
/** Sends one message to one device and returns the push service's HTTP status (0 = network failure). */
export type Transport = (sub: Sub, msg: Msg, env: Env) => Promise<number>;

export const defaultTransport: Transport = async (sub, msg, env) => {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return 0;
  try {
    const payload = await buildPushPayload(
      { data: msg, options: { ttl: 6 * 3600, urgency: 'normal' } },
      { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      { subject: env.VAPID_SUBJECT ?? 'mailto:admin@example.com', publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
    );
    return (await fetch(sub.endpoint, payload)).status;
  } catch (e) {
    console.error('push failed', e);
    return 0;
  }
};

let transport: Transport = defaultTransport;
/** Tests swap the real network call for a fake. */
export const setTransport = (t: Transport) => { transport = t; };
export const resetTransport = () => { transport = defaultTransport; };

/**
 * Sends `msg` to every device of `userIds`. With `dedupKeyOf`, a user whose key is already logged is skipped,
 * so a re-run of a cron or a repeated save never notifies twice. Devices the push service rejects (404/410) are removed.
 * Returns how many devices were sent to.
 */
export async function sendToUsers(env: Env, userIds: string[], msg: Msg, dedupKeyOf: ((userId: string) => string) | null, t: Transport = transport): Promise<number> {
  let sent = 0;
  for (const userId of userIds) {
    const subs = (await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').bind(userId).all<Sub>()).results;
    if (subs.length === 0) continue;
    if (dedupKeyOf) {
      const r = await env.DB.prepare('INSERT OR IGNORE INTO notification_log (key, sent_at) VALUES (?, ?)').bind(dedupKeyOf(userId), new Date().toISOString()).run();
      if (r.meta.changes === 0) continue;
    }
    for (const s of subs) {
      const status = await t(s, msg, env);
      if (status === 404 || status === 410) await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(s.endpoint).run();
      else if (status >= 200 && status < 300) sent++;
    }
  }
  return sent;
}
