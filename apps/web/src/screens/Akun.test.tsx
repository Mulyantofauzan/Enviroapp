import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderApp, json } from '../test-utils';
import { enqueue, listItems } from '../lib/outbox/queue';

afterEach(() => vi.unstubAllGlobals());
const item = { owner: 'u1', kind: 'weather' as const, key: 'weather|2026-11-02', label: 'Cuaca 2 Nov', request: { method: 'PUT' as const, path: '/weather/2026-11-02', body: {} } };
const offline = (_u: string, init?: RequestInit): Response | undefined => { if (init?.method === 'PUT') throw new TypeError('offline'); return undefined; };
const loggedOut = (calls: { url: string }[]) => calls.some((c) => c.url === '/api/auth/logout');

describe('Keluar with a queue', () => {
  it('asks first, says how many are waiting, and Batal stays signed in', async () => {
    await enqueue(item);
    const calls = mockApi({ handler: offline });
    renderApp('/akun');
    await waitFor(() => expect(screen.getByRole('button', { name: /Keluar/ })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Keluar/ }));
    expect(await screen.findByText(/Ada 1 data belum terunggah/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(loggedOut(calls)).toBe(false);
  });
  it('Tetap keluar signs out, clears the read cache and keeps the queue', async () => {
    await enqueue(item);
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });
    const calls = mockApi({ handler: offline });
    renderApp('/akun');
    await userEvent.click(await screen.findByRole('button', { name: /Keluar/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Tetap keluar' }));
    await waitFor(() => expect(loggedOut(calls)).toBe(true));
    expect(del).toHaveBeenCalledWith('evo-api');
    expect(await listItems('u1')).toHaveLength(1);
  });
  it('without a queue it signs out at once', async () => {
    const calls = mockApi();
    renderApp('/akun');
    await userEvent.click(await screen.findByRole('button', { name: /Keluar/ }));
    await waitFor(() => expect(loggedOut(calls)).toBe(true));
  });
});

describe('Login note', () => {
  it('tells the person that data is waiting on this phone', async () => {
    await enqueue(item);
    mockApi({ handler: (u) => (u.startsWith('/api/auth/me') ? json({ error: 'Silakan masuk.' }, 401) : undefined) });
    renderApp('/');
    expect(await screen.findByText(/Ada 1 data belum terunggah di HP ini/)).toBeInTheDocument();
  });
});
