import { api, ApiError } from '../../api/client';
import type { OutboxItem } from './db';
import { listItems, loadBlob, markFailed, removeItem, scheduleRetry, subscribe } from './queue';

export type SyncResult = { sent: number; failed: number; remaining: number; paused: 'auth' | null };

const BACKOFF_SECONDS = [5, 15, 60, 300];
// No signal costs the server nothing, so it is retried more often than a server error.
const NO_SIGNAL_SECONDS = [5, 15, 30];
const ALREADY_DONE = 'Event ini sudah selesai.';
const LOCKED = 'Event sudah selesai. Eviden tidak bisa diubah.';
const POLL_MS = 30_000;
const DATA_KINDS = new Set(['weather', 'water', 'coagulant']);

const delayFor = (tries: number, steps = BACKOFF_SECONDS) => steps[Math.min(tries, steps.length - 1)] * 1000;

/** Sends one item. Resolves when the server has it (or already has something newer); throws ApiError otherwise. */
async function send(item: OutboxItem): Promise<void> {
  const { request } = item;
  if (item.kind === 'evidence') {
    const form = new FormData();
    const blob = (await loadBlob(item.id)) ?? new Blob();
    form.append('file', new File([blob], request.filename ?? 'foto.jpg', { type: blob.type }));
    for (const [k, v] of Object.entries(request.fields ?? {})) form.append(k, v);
    form.append('client_id', item.id);
    await api(request.path, { method: 'POST', body: form });
    return;
  }
  const body = DATA_KINDS.has(item.kind) ? JSON.stringify({ ...request.body, recorded_at: item.recordedAt })
    : item.kind === 'complete' ? JSON.stringify({ recorded_at: item.recordedAt }) : undefined;
  await api(request.path, { method: request.method, body });
}

async function round(owner: string, now: number, force: boolean): Promise<SyncResult> {
  const items = await listItems(owner);
  const photosLeft = new Map<string, number>();
  for (const i of items) if (i.kind === 'evidence' && i.group) photosLeft.set(i.group, (photosLeft.get(i.group) ?? 0) + 1);
  let sent = 0, failed = 0, paused: SyncResult['paused'] = null;

  const settled = (i: OutboxItem) => { if (i.kind === 'evidence' && i.group) photosLeft.set(i.group, (photosLeft.get(i.group) ?? 1) - 1); };

  for (const item of items) {
    if (item.status !== 'pending' || (!force && item.nextAt > now)) continue;
    if (item.kind === 'complete' && item.group && (photosLeft.get(item.group) ?? 0) > 0) continue;
    try {
      await send(item);
      await removeItem(item.id);
      settled(item);
      sent++;
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      const message = e instanceof Error ? e.message : '';
      if (status === 401) { paused = 'auth'; break; }
      if (status === 409 && ((item.kind === 'complete' && message === ALREADY_DONE) || (item.kind === 'evidence' && message === LOCKED))) {
        await removeItem(item.id);
        settled(item);
        sent++;
        continue;
      }
      if (status === 0) { await scheduleRetry(item.id, now + delayFor(item.tries, NO_SIGNAL_SECONDS)); break; }
      if (status >= 500) { await scheduleRetry(item.id, now + delayFor(item.tries)); continue; }
      await markFailed(item.id, message || 'Data ditolak server.');
      failed++;
    }
  }
  const remaining = (await listItems(owner)).length;
  if (sent > 0 && remaining === 0) window.dispatchEvent(new Event('outbox:drained'));
  return { sent, failed, remaining, paused };
}

let running: Promise<SyncResult> | null = null;

/** One round at a time, in this page and (where Web Locks exist) across tabs. */
/** `force` ignores retry waits (used when the phone reports it is back online). */
export function runSync(owner: string, now: number = Date.now(), force = false): Promise<SyncResult> {
  if (running) return running;
  const skipped = async (): Promise<SyncResult> => ({ sent: 0, failed: 0, remaining: (await listItems(owner)).length, paused: null });
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  const go: Promise<SyncResult> = (async () => (locks
    ? await locks.request('evo-outbox-sync', { ifAvailable: true }, (lock) => (lock ? round(owner, now, force) : skipped()))
    : await round(owner, now, force)))();
  running = go.finally(() => { running = null; });
  return running;
}

/** Runs a round now, when the phone comes online, when the tab returns, every 30 s, and after every queue change. */
export function startSync(getOwner: () => string | null): () => void {
  let forced = false;
  const trigger = () => {
    const o = getOwner();
    const force = forced;
    forced = false;
    if (o) void runSync(o, Date.now(), force).catch(() => {});
  };
  let scheduled = false;
  const soon = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; trigger(); });
  };
  const back = () => { forced = true; soon(); };
  const visible = () => { if (document.visibilityState === 'visible') back(); };
  window.addEventListener('online', back);
  document.addEventListener('visibilitychange', visible);
  const timer = setInterval(trigger, POLL_MS);
  const off = subscribe(soon);
  trigger();
  return () => {
    window.removeEventListener('online', back);
    document.removeEventListener('visibilitychange', visible);
    clearInterval(timer);
    off();
  };
}
