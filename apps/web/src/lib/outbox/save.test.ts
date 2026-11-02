import { describe, it, expect, vi, afterEach } from 'vitest';
import { enqueue, listItems } from './queue';
import { completeEvent, saveEntry, saveEvidence } from './save';
import { runSync } from './sync';

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

describe('saveEvidence and completeEvent', () => {
  const photoArgs = { owner: 'u1', scheduleId: 's1', date: '2026-11-02', label: 'Foto Cek Saluran', file: new File(['abc'], 'foto-1.jpg', { type: 'image/jpeg' }), fields: { source: 'camera', taken_at: '2026-11-02T01:00:00.000Z' } };
  const offline = () => vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));

  it('online: sends the file, the fields and a client_id', async () => {
    const f = reply(201, { id: 'e1' });
    vi.stubGlobal('fetch', f);
    expect(await saveEvidence(photoArgs)).toEqual({ queued: false });
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe('/api/events/s1/2026-11-02/evidence');
    const form = init.body as FormData;
    expect(form.get('source')).toBe('camera');
    expect(String(form.get('client_id'))).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect((form.get('file') as File).name).toBe('foto-1.jpg');
  });

  it('offline: queues the photo with its group, bytes and metadata; item id is what will be sent as client_id', async () => {
    offline();
    expect(await saveEvidence(photoArgs)).toEqual({ queued: true });
    const [item] = await listItems('u1');
    expect(item).toMatchObject({ kind: 'evidence', group: 's1|2026-11-02', request: { method: 'POST', path: '/events/s1/2026-11-02/evidence', filename: 'foto-1.jpg', fields: photoArgs.fields } });
    expect(item.blob?.size).toBe(3);
    expect(item.key).toBe(`evidence|s1|2026-11-02|${item.id}`);
    const f = reply(201, { id: 'e1' });
    vi.stubGlobal('fetch', f);
    await runSync('u1');
    expect((((f.mock.calls[0] as any)[1].body) as FormData).get('client_id')).toBe(item.id);
  });

  it('a refused photo (400) is thrown and not queued', async () => {
    vi.stubGlobal('fetch', reply(400, { error: 'Jenis berkas tidak didukung. Gunakan foto atau PDF.' }));
    await expect(saveEvidence(photoArgs)).rejects.toThrow('Jenis berkas tidak didukung');
    expect(await listItems('u1')).toEqual([]);
  });

  it('offline completion is queued and only goes out after its photo', async () => {
    offline();
    await saveEvidence(photoArgs);
    expect(await completeEvent({ owner: 'u1', scheduleId: 's1', date: '2026-11-02', label: 'Selesai Cek Saluran' })).toEqual({ queued: true });
    const f = reply(200);
    vi.stubGlobal('fetch', f);
    await runSync('u1');
    expect(f.mock.calls.map((c: any) => c[0])).toEqual(['/api/events/s1/2026-11-02/evidence', '/api/events/s1/2026-11-02/complete']);
  });

  it('online completion sends a POST and reports queued:false', async () => {
    const f = reply(200);
    vi.stubGlobal('fetch', f);
    expect(await completeEvent({ owner: 'u1', scheduleId: 's1', date: '2026-11-02', label: 'x' })).toEqual({ queued: false });
    expect((f.mock.calls[0] as any)[1].method).toBe('POST');
  });
});
