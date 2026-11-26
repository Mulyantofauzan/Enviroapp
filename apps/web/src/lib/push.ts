import { api, post } from '../api/client';

export type PushSupport = 'ok' | 'unsupported' | 'needs-install';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () => (navigator as any).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;

/** iPhone only delivers push to an app added to the Home Screen. */
export function pushSupport(): PushSupport {
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'ok';
}

const registration = () => navigator.serviceWorker.ready;

export async function isSubscribed(): Promise<boolean> {
  if (pushSupport() !== 'ok') return false;
  return (await (await registration()).pushManager.getSubscription()) !== null;
}

function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Asks for permission (must follow a tap), subscribes this device and tells the server. */
export async function enablePush(): Promise<void> {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Izin notifikasi ditolak. Ubah di pengaturan browser.');
  const { key } = await api<{ key: string }>('/push/key');
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource });
  await post('/push/subscribe', sub.toJSON());
}

/** Removes this device's subscription from the server, then from the browser. Safe to call when push is not set up. */
export async function disablePush(): Promise<void> {
  if (pushSupport() !== 'ok') return;
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  await api('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
