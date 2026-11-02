import { describe, it, expect, vi, afterEach } from 'vitest';
import { enqueue, listItems } from './queue';
import { saveEntry } from './save';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const entry = { owner: 'u1', kind: 'weather' as const, key: 'weather|2026-11-02', label: 'Cuaca 2 Nov', path: '/weather/2026-11-02', body: { rainfall_mm: 5, rain_hours: 1 } };
const reply = (status: number, o: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(o), { status }));

describe('saveEntry', () => {
  it('sends online with recorded_at and reports queued:false', async () => {
    const f = reply(200, { applied: true });
    vi.stubGlobal('fetch', f);
    expect(await saveEntry(entry)).toEqual({ queued: false });
    const sent = JSON.parse((f.mock.calls[0] as any)[1].body);
    expect(sent).toMatchObject({ rainfall_mm: 5, rain_hours: 1 });
    expect(sent.recorded_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await listItems('u1')).toEqual([]);
  });

  it('a successful online save drops an older pending item for the same key', async () => {
    await enqueue({ owner: 'u1', kind: 'weather', key: entry.key, label: 'x', request: { method: 'PUT', path: entry.path, body: { rainfall_mm: 1 } } });
    vi.stubGlobal('fetch', reply(200));
    await saveEntry(entry);
    expect(await listItems('u1')).toEqual([]);
  });

  it('a network failure queues the item with the time the user saved', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await saveEntry(entry)).toEqual({ queued: true });
    const [item] = await listItems('u1');
    expect(item).toMatchObject({ kind: 'weather', key: entry.key, label: 'Cuaca 2 Nov', request: { method: 'PUT', path: entry.path, body: entry.body } });
    expect(item.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('a 401 queues too, so nothing typed is lost', async () => {
    vi.stubGlobal('fetch', reply(401, { error: 'Silakan masuk.' }));
    expect(await saveEntry(entry)).toEqual({ queued: true });
    expect(await listItems('u1')).toHaveLength(1);
  });

  it('a 400 is thrown with the server message and nothing is queued', async () => {
    vi.stubGlobal('fetch', reply(400, { error: 'Curah hujan harus berupa angka.' }));
    await expect(saveEntry(entry)).rejects.toThrow('Curah hujan harus berupa angka.');
    expect(await listItems('u1')).toEqual([]);
  });

  it('without IndexedDB an offline save fails as before', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    vi.stubGlobal('indexedDB', undefined);
    await expect(saveEntry(entry)).rejects.toThrow('Tidak ada koneksi. Coba lagi.');
  });

  it('when the queue cannot be written the user is told', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const db = await import('./db');
    vi.spyOn(db, 'putItem').mockRejectedValueOnce(new Error('QuotaExceededError'));
    await expect(saveEntry(entry)).rejects.toThrow('Tidak bisa menyimpan di HP. Ruang penyimpanan penuh atau diblokir.');
  });
});
