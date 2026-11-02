import { describe, it, expect, vi, afterEach } from 'vitest';
import * as db from './db';
import { enqueue, listItems, loadBlob, markFailed, removeItem, removePending, retryItem, scheduleRetry, subscribe } from './queue';

afterEach(() => vi.restoreAllMocks());

const base = { owner: 'u1', kind: 'weather' as const, key: 'weather|2026-11-02', label: 'Cuaca 2 Nov', request: { method: 'PUT' as const, path: '/weather/2026-11-02', body: { rainfall_mm: 5 } } };

describe('photo bytes', () => {
  it('listing never loads the photos, loadBlob reads exactly one', async () => {
    const a = await enqueue({ ...base, kind: 'evidence', key: 'e1', blob: new Blob(['aaa'], { type: 'image/jpeg' }) });
    await enqueue({ ...base, kind: 'evidence', key: 'e2', blob: new Blob(['bbbbb'], { type: 'image/png' }) });
    const items = await listItems('u1');
    expect(items.every((i) => i.blob === null)).toBe(true);
    expect((await loadBlob(a.id))?.size).toBe(3);
  });
  it('removing an item removes its photo', async () => {
    const a = await enqueue({ ...base, kind: 'evidence', key: 'e1', blob: new Blob(['aaa'], { type: 'image/jpeg' }) });
    await removeItem(a.id);
    expect(await loadBlob(a.id)).toBeNull();
  });
  it('a replaced pending item takes its photo with it', async () => {
    const a = await enqueue({ ...base, kind: 'evidence', key: 'same', blob: new Blob(['aaa'], { type: 'image/jpeg' }) });
    await enqueue({ ...base, kind: 'evidence', key: 'same', blob: new Blob(['bb'], { type: 'image/jpeg' }) });
    expect(await loadBlob(a.id)).toBeNull();
  });
});

describe('outbox queue', () => {
  it('assigns an ascending seq and starts pending', async () => {
    const a = await enqueue(base);
    const b = await enqueue({ ...base, key: 'weather|2026-11-03' });
    expect(a.status).toBe('pending');
    expect(b.seq).toBeGreaterThan(a.seq);
    expect(a.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(a.tries).toBe(0);
  });

  it('replaces a pending item with the same owner and key', async () => {
    const a = await enqueue(base);
    const b = await enqueue({ ...base, request: { ...base.request, body: { rainfall_mm: 9 } }, recordedAt: '2026-11-02T10:00:00.000Z' });
    const items = await listItems('u1');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(b.id);
    expect(items[0].seq).toBeGreaterThan(a.seq);
    expect(items[0].recordedAt).toBe('2026-11-02T10:00:00.000Z');
    expect(items[0].request.body).toEqual({ rainfall_mm: 9 });
  });

  it('keeps a failed item and adds a new one for the same key; other owners are separate', async () => {
    const a = await enqueue(base);
    await markFailed(a.id, 'Curah hujan harus berupa angka.');
    await enqueue(base);
    expect(await listItems('u1')).toHaveLength(2);
    await enqueue({ ...base, owner: 'u2' });
    expect(await listItems('u2')).toHaveLength(1);
    expect(await listItems('u1')).toHaveLength(2);
  });

  it('lists only the owner\'s items in seq order', async () => {
    await enqueue({ ...base, key: 'k1' });
    await enqueue({ ...base, owner: 'u2', key: 'k2' });
    await enqueue({ ...base, key: 'k3' });
    expect((await listItems('u1')).map((i) => i.key)).toEqual(['k1', 'k3']);
  });

  it('markFailed then retryItem returns it to pending', async () => {
    const a = await enqueue(base);
    await markFailed(a.id, 'galat');
    expect((await listItems('u1'))[0]).toMatchObject({ status: 'failed', error: 'galat' });
    await scheduleRetry(a.id, 5000);
    await retryItem(a.id);
    expect((await listItems('u1'))[0]).toMatchObject({ status: 'pending', error: null, tries: 0, nextAt: 0 });
  });

  it('scheduleRetry counts tries and sets nextAt', async () => {
    const a = await enqueue(base);
    await scheduleRetry(a.id, 12345);
    await scheduleRetry(a.id, 23456);
    expect((await listItems('u1'))[0]).toMatchObject({ tries: 2, nextAt: 23456 });
  });

  it('removePending deletes only pending items for the key', async () => {
    const a = await enqueue(base);
    await markFailed(a.id, 'x');
    await enqueue(base);
    await removePending('u1', base.key);
    const left = await listItems('u1');
    expect(left).toHaveLength(1);
    expect(left[0].status).toBe('failed');
  });

  it('removeItem deletes by id', async () => {
    const a = await enqueue(base);
    await removeItem(a.id);
    expect(await listItems('u1')).toEqual([]);
  });

  it('stores a blob and reads it back with the same size', async () => {
    const added = await enqueue({ ...base, kind: 'evidence', key: 'evidence|s|d|1', blob: new Blob(['abcdef'], { type: 'image/jpeg' }) });
    const blob = await loadBlob(added.id);
    expect(blob?.size).toBe(6);
    expect(blob?.type).toBe('image/jpeg');
  });

  it('notifies subscribers once per change and stops after unsubscribe', async () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    const a = await enqueue(base);
    expect(fn).toHaveBeenCalledTimes(1);
    await removeItem(a.id);
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    await enqueue(base);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('a failed write rejects with a clear message and changes nothing', async () => {
    await enqueue({ ...base, key: 'keep' });
    vi.spyOn(db, 'putItem').mockRejectedValueOnce(new Error('QuotaExceededError'));
    await expect(enqueue(base)).rejects.toThrow('Tidak bisa menyimpan di HP. Ruang penyimpanan penuh atau diblokir.');
    expect((await listItems('u1')).map((i) => i.key)).toEqual(['keep']);
  });

  it('asks for persistent storage when the first item is created', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { ...navigator, storage: { persist } });
    await enqueue(base);
    expect(persist).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
