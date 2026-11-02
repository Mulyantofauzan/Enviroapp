import { allItems, deleteItem, outboxAvailable, putItem, updateItem, type Stored, type OutboxItem, type OutboxKind, type OutboxRequest } from './db';

const CHANNEL = 'evo-outbox';
const FULL = 'Tidak bisa menyimpan di HP. Ruang penyimpanan penuh atau diblokir.';

const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function bus(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => listeners.forEach((fn) => fn());
  return channel;
}

/** Calls `fn` after every change, including changes made in other tabs. */
export function subscribe(fn: () => void): () => void {
  bus();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function changed() {
  listeners.forEach((fn) => fn());
  try { bus()?.postMessage('changed'); } catch { /* the channel is optional */ }
}

const bySeq = (a: OutboxItem, b: OutboxItem) => a.seq - b.seq;

export type NewItem = {
  id?: string; owner: string; kind: OutboxKind; key: string; group?: string | null; label: string;
  request: OutboxRequest; blob?: Blob | null; recordedAt?: string;
};

/** Adds an item. A pending item with the same owner and key is replaced; a failed one is kept. */
export async function enqueue(i: NewItem): Promise<OutboxItem> {
  try {
    const all = await allItems();
    if (all.length === 0) {
      try { void navigator.storage?.persist?.(); } catch { /* best effort */ }
    }
    const item: OutboxItem = {
      id: i.id ?? crypto.randomUUID(), owner: i.owner, kind: i.kind, key: i.key, group: i.group ?? null, label: i.label,
      request: i.request, blob: i.blob ?? null, recordedAt: i.recordedAt ?? new Date().toISOString(),
      seq: Math.max(0, ...all.map((x) => x.seq)) + 1, status: 'pending', error: null, tries: 0, nextAt: 0,
    };
    await putItem(item);
    for (const old of all.filter((x) => x.owner === i.owner && x.key === i.key && x.status === 'pending')) await deleteItem(old.id);
    changed();
    return item;
  } catch {
    throw new Error(FULL);
  }
}

export async function listItems(owner: string): Promise<OutboxItem[]> {
  if (!outboxAvailable()) return [];
  return (await allItems()).filter((x) => x.owner === owner).sort(bySeq);
}

async function update(id: string, patch: (x: Stored) => Partial<Stored>) {
  if (await updateItem(id, patch)) changed();
}

export async function removeItem(id: string) { await deleteItem(id); changed(); }
export const markFailed = (id: string, error: string) => update(id, () => ({ status: 'failed', error }));
export const retryItem = (id: string) => update(id, () => ({ status: 'pending', error: null, tries: 0, nextAt: 0 }));
export const scheduleRetry = (id: string, nextAt: number) => update(id, (x) => ({ tries: x.tries + 1, nextAt }));

export async function removePending(owner: string, key: string) {
  const gone = (await allItems()).filter((x) => x.owner === owner && x.key === key && x.status === 'pending');
  for (const x of gone) await deleteItem(x.id);
  if (gone.length) changed();
}
