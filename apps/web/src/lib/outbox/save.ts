import { api, isNetworkError, put } from '../../api/client';
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

export type EvidenceToSave = { owner: string; scheduleId: string; date: string; label: string; file: File; fields: Record<string, string> };

/** Uploads one evidence file, or keeps it (bytes, GPS and capture time included) in the outbox until there is signal. */
export async function saveEvidence(o: EvidenceToSave): Promise<SaveResult> {
  const clientId = crypto.randomUUID();
  const path = `/events/${o.scheduleId}/${o.date}/evidence`;
  const form = new FormData();
  form.append('file', o.file);
  for (const [k, v] of Object.entries(o.fields)) form.append(k, v);
  form.append('client_id', clientId);
  try {
    await api(path, { method: 'POST', body: form });
    return { queued: false };
  } catch (e) {
    if (!isNetworkError(e) || !outboxAvailable()) throw e;
    await enqueue({
      id: clientId, owner: o.owner, kind: 'evidence', key: `evidence|${o.scheduleId}|${o.date}|${clientId}`, group: `${o.scheduleId}|${o.date}`,
      label: o.label, request: { method: 'POST', path, fields: o.fields, filename: o.file.name }, blob: o.file,
    });
    return { queued: true };
  }
}

/** Completes an event, or queues the completion to go out after its photos. */
export async function completeEvent(o: { owner: string; scheduleId: string; date: string; label: string }): Promise<SaveResult> {
  const path = `/events/${o.scheduleId}/${o.date}/complete`;
  try {
    await api(path, { method: 'POST' });
    return { queued: false };
  } catch (e) {
    if (!isNetworkError(e) || !outboxAvailable()) throw e;
    await enqueue({ owner: o.owner, kind: 'complete', key: `complete|${o.scheduleId}|${o.date}`, group: `${o.scheduleId}|${o.date}`, label: o.label, request: { method: 'POST', path } });
    return { queued: true };
  }
}
