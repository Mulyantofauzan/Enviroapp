import { isNetworkError, put } from '../../api/client';
import type { OutboxKind } from './db';
import { outboxAvailable } from './db';
import { enqueue, removePending } from './queue';

export type SaveResult = { queued: boolean };

export type EntryToSave = {
  owner: string; kind: Extract<OutboxKind, 'weather' | 'water' | 'coagulant'>; key: string; label: string;
  path: string; body: Record<string, unknown>;
};

/**
 * Saves one day entry. Online it goes straight to the server; with no connection (or an expired session)
 * it waits in the outbox with the time the user pressed save. Any other refusal is thrown for the screen to show.
 */
export async function saveEntry(o: EntryToSave): Promise<SaveResult> {
  const recordedAt = new Date().toISOString();
  try {
    await put(o.path, { ...o.body, recorded_at: recordedAt });
    if (outboxAvailable()) await removePending(o.owner, o.key).catch(() => {});
    return { queued: false };
  } catch (e) {
    if (!isNetworkError(e) || !outboxAvailable()) throw e;
    await enqueue({ owner: o.owner, kind: o.kind, key: o.key, label: o.label, request: { method: 'PUT', path: o.path, body: o.body }, recordedAt });
    return { queued: true };
  }
}
