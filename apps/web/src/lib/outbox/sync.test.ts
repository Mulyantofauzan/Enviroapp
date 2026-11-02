import { describe, it, expect, vi, afterEach } from 'vitest';
import { enqueue, listItems } from './queue';
import { runSync, startSync } from './sync';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

type Reply = Response | Error;
const ok = (o: unknown = { ok: true }, status = 200) => new Response(JSON.stringify(o), { status });
const err = (message: string, status: number) => new Response(JSON.stringify({ error: message }), { status });

function stubFetch(handler: (url: string, init: RequestInit) => Reply | Promise<Reply>) {
  const calls: { url: string; method: string; body: any; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const raw = init.body;
    calls.push({ url, method: init.method ?? 'GET', body: typeof raw === 'string' ? JSON.parse(raw) : raw, init });
    const r = await handler(url, init);
    if (r instanceof Error) throw r;
    return r;
  }));
  return calls;
}

const data = (key: string, path = '/weather/2026-11-02', body: Record<string, unknown> = { rainfall_mm: 5 }, owner = 'u1') =>
  enqueue({ owner, kind: 'weather', key, label: key, request: { method: 'PUT', path, body } });
const photo = (n: number, group = 's1|2026-11-02', owner = 'u1') =>
  enqueue({ owner, kind: 'evidence', key: `evidence|s1|2026-11-02|${n}`, group, label: `Foto ${n}`, request: { method: 'POST', path: '/events/s1/2026-11-02/evidence', fields: { source: 'gallery' }, filename: 'foto.jpg' }, blob: new Blob(['abc'], { type: 'image/jpeg' }) });
const done = (group = 's1|2026-11-02') =>
  enqueue({ owner: 'u1', kind: 'complete', key: 'complete|s1|2026-11-02', group, label: 'Selesai', request: { method: 'POST', path: '/events/s1/2026-11-02/complete' } });

describe('runSync', () => {
  it('sends the item with recorded_at and removes it', async () => {
    const it1 = await data('weather|2026-11-02');
    const calls = stubFetch(() => ok());
    const r = await runSync('u1');
    expect(r).toMatchObject({ sent: 1, failed: 0, remaining: 0, paused: null });
    expect(calls[0].url).toBe('/api/weather/2026-11-02');
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].body).toEqual({ rainfall_mm: 5, recorded_at: it1.recordedAt });
    expect(await listItems('u1')).toEqual([]);
  });

  it('applied:false (a newer entry exists) removes the item quietly', async () => {
    await data('weather|2026-11-02');
    stubFetch(() => ok({ applied: false }));
    expect(await runSync('u1')).toMatchObject({ sent: 1, failed: 0, remaining: 0 });
  });

  it('a network error stops the round, keeps the item and counts a try', async () => {
    await data('weather|2026-11-02');
    await data('weather|2026-11-03', '/weather/2026-11-03');
    const calls = stubFetch(() => new TypeError('offline'));
    const r = await runSync('u1', 1_000_000);
    expect(calls).toHaveLength(1);
    expect(r.remaining).toBe(2);
    const [first] = await listItems('u1');
    expect(first).toMatchObject({ tries: 1, nextAt: 1_005_000, status: 'pending' });
  });

  it('a 500 backs off 5 s then 15 s, and other groups still go out', async () => {
    await photo(1, 'g1');
    await data('weather|2026-11-03', '/weather/2026-11-03');
    const calls = stubFetch((url) => (url.includes('evidence') ? err('Terjadi kesalahan.', 500) : ok()));
    await runSync('u1', 1_000);
    expect(calls.map((c) => c.url)).toEqual(['/api/events/s1/2026-11-02/evidence', '/api/weather/2026-11-03']);
    expect((await listItems('u1'))[0]).toMatchObject({ tries: 1, nextAt: 6_000 });
    await runSync('u1', 2_000); // still waiting
    expect(calls).toHaveLength(2);
    await runSync('u1', 6_000);
    expect((await listItems('u1'))[0]).toMatchObject({ tries: 2, nextAt: 21_000 });
  });

  it('401 pauses the whole queue and loses nothing', async () => {
    await data('weather|2026-11-02');
    await data('weather|2026-11-03', '/weather/2026-11-03');
    const calls = stubFetch(() => err('Silakan masuk.', 401));
    const r = await runSync('u1');
    expect(r.paused).toBe('auth');
    expect(calls).toHaveLength(1);
    expect((await listItems('u1')).map((i) => i.status)).toEqual(['pending', 'pending']);
  });

  it('a 400 marks the item failed with the server message and is not retried', async () => {
    await data('weather|2026-11-02');
    const calls = stubFetch(() => err('Curah hujan harus berupa angka.', 400));
    expect(await runSync('u1')).toMatchObject({ failed: 1, remaining: 1 });
    expect((await listItems('u1'))[0]).toMatchObject({ status: 'failed', error: 'Curah hujan harus berupa angka.' });
    await runSync('u1');
    expect(calls).toHaveLength(1);
  });

  it('complete waits for every photo of its event, then goes out in the same round', async () => {
    await photo(1);
    await photo(2);
    await done();
    const calls = stubFetch(() => ok());
    await runSync('u1');
    expect(calls.map((c) => c.url)).toEqual(['/api/events/s1/2026-11-02/evidence', '/api/events/s1/2026-11-02/evidence', '/api/events/s1/2026-11-02/complete']);
  });

  it('complete does not go out while a photo failed or is waiting to retry', async () => {
    await photo(1);
    await done();
    const calls = stubFetch((url) => (url.includes('evidence') ? err('Jenis berkas tidak didukung.', 400) : ok()));
    await runSync('u1');
    expect(calls.map((c) => c.url)).toEqual(['/api/events/s1/2026-11-02/evidence']);
    expect((await listItems('u1')).map((i) => i.kind)).toEqual(['evidence', 'complete']);
  });

  it('complete answered 409 "sudah selesai" counts as done', async () => {
    await done();
    stubFetch(() => err('Event ini sudah selesai.', 409));
    expect(await runSync('u1')).toMatchObject({ sent: 1, failed: 0, remaining: 0 });
  });

  it('a photo for an event that is already complete is dropped, not stuck', async () => {
    await photo(1);
    stubFetch(() => err('Event sudah selesai. Eviden tidak bisa diubah.', 409));
    expect(await runSync('u1')).toMatchObject({ sent: 1, failed: 0, remaining: 0 });
  });

  it('a photo goes out as multipart with the file, fields and client_id = item id', async () => {
    const p = await photo(1);
    const calls = stubFetch(() => ok({ id: 'e1' }, 201));
    await runSync('u1');
    const form = calls[0].body as FormData;
    expect(form.get('client_id')).toBe(p.id);
    expect(form.get('source')).toBe('gallery');
    const file = form.get('file') as File;
    expect(file.name).toBe('foto.jpg');
    expect(file.size).toBe(3);
  });

  it("another user's items are not touched", async () => {
    await data('weather|2026-11-02', '/weather/2026-11-02', {}, 'u2');
    const calls = stubFetch(() => ok());
    expect(await runSync('u1')).toMatchObject({ sent: 0, remaining: 0 });
    expect(calls).toHaveLength(0);
    expect(await listItems('u2')).toHaveLength(1);
  });

  it('two simultaneous rounds send each item once', async () => {
    await data('weather|2026-11-02');
    const calls = stubFetch(async () => { await new Promise((r) => setTimeout(r, 10)); return ok(); });
    await Promise.all([runSync('u1'), runSync('u1')]);
    expect(calls).toHaveLength(1);
  });

  it('announces outbox:drained once the queue is empty', async () => {
    await data('weather|2026-11-02');
    stubFetch(() => ok());
    const fn = vi.fn();
    window.addEventListener('outbox:drained', fn);
    await runSync('u1');
    window.removeEventListener('outbox:drained', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('retry timing', () => {
  it('a network error is retried after 5 s, 15 s, then never waits longer than 30 s', async () => {
    await data('weather|2026-11-02');
    stubFetch(() => new TypeError('offline'));
    const waits: number[] = [];
    let now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      await runSync('u1', now);
      const [item] = await listItems('u1');
      waits.push(item.nextAt - now);
      now = item.nextAt;
    }
    expect(waits).toEqual([5000, 15000, 30000, 30000, 30000]);
  });

  it('coming back online retries at once, ignoring the wait', async () => {
    await data('weather|2026-11-02');
    const calls = stubFetch(() => new TypeError('offline'));
    await runSync('u1');
    expect((await listItems('u1'))[0].nextAt).toBeGreaterThan(Date.now());
    calls.length = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    const stop = startSync(() => 'u1');
    await new Promise((r) => setTimeout(r, 20));
    expect(await listItems('u1')).toHaveLength(1); // a plain round respects the wait
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(async () => expect(await listItems('u1')).toEqual([]));
    stop();
  });
});

describe('startSync', () => {
  it('runs on the online event and stops after cleanup', async () => {
    const calls = stubFetch(() => ok());
    const stop = startSync(() => 'u1');
    await new Promise((r) => setTimeout(r, 20));
    await data('weather|2026-11-02');
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    stop();
    await data('weather|2026-11-03', '/weather/2026-11-03');
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toHaveLength(1);
  });
});
