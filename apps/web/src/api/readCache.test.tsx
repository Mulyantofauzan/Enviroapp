import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthContext';
import { api } from './client';
import { clearReadCache } from './readCache';

afterEach(() => vi.unstubAllGlobals());

describe('read cache', () => {
  it('clearReadCache deletes evo-api and never throws', async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });
    await clearReadCache();
    expect(del).toHaveBeenCalledWith('evo-api');
    vi.stubGlobal('caches', { delete: async () => { throw new Error('x'); } });
    await expect(clearReadCache()).resolves.toBeUndefined();
  });

  it('an expired session (401) empties the cache so the next person cannot see the last one\'s data', async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/auth/me' ? new Response(JSON.stringify({ id: 'u1', name: 'A', role: 'Operator' })) : new Response(JSON.stringify({ error: 'Silakan masuk.' }), { status: 401 }))));
    render(<AuthProvider><span /></AuthProvider>);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await api('/day').catch(() => {});
    await waitFor(() => expect(del).toHaveBeenCalledWith('evo-api'));
  });

  it('signing in empties it too', async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/auth/me' ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ id: 'u2', name: 'B', role: 'Operator' })))));
    let login!: (e: string, p: string) => Promise<void>;
    const { useAuth } = await import('../auth/AuthContext');
    const Probe = () => { login = useAuth().login; return null; };
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(login).toBeTypeOf('function'));
    del.mockClear();
    await login('b@x.id', 'pw');
    expect(del).toHaveBeenCalledWith('evo-api');
  });
});
