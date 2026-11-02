import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, ApiError, setUnauthorizedHandler } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('throws ApiError with the server message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Wrong email or password.' }), { status: 401 })));
    await expect(api('/auth/login', { method: 'POST' })).rejects.toMatchObject({ message: 'Wrong email or password.', status: 401 });
  });
  it('network failure gives a plain message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const err: any = await api('/day').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Tidak ada koneksi. Coba lagi.');
  });
  it('401 calls the unauthorized handler', async () => {
    const h = vi.fn();
    setUnauthorizedHandler(h);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Please sign in.' }), { status: 401 })));
    await api('/day').catch(() => {});
    expect(h).toHaveBeenCalled();
  });
  it('returns parsed json and sends cookies', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    expect(await api('/ponds')).toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledWith('/api/ponds', expect.objectContaining({ credentials: 'include' }));
  });
});

describe('api fallback message', () => {
  it('a non-JSON error body gives an Indonesian message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>boom</html>', { status: 502 })));
    const err: any = await api('/day').catch((e) => e);
    expect(err.message).toBe('Terjadi kesalahan. Coba lagi.');
  });
});

describe('api with FormData', () => {
  it('lets the browser set the multipart content-type', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    await api('/events/x/2026-11-02/evidence', { method: 'POST', body: new FormData() });
    const init = (f.mock.calls[0] as any)[1];
    expect(new Headers(init.headers).has('content-type')).toBe(false);
  });
  it('still sends JSON bodies as JSON', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    await api('/x', { method: 'POST', body: '{"a":1}' });
    expect(new Headers((f.mock.calls[0] as any)[1].headers).get('content-type')).toBe('application/json');
  });
});
