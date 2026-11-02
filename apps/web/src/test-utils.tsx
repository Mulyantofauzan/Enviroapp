import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@evo/shared';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { App } from './App';

export const POND = {
  id: 'p1', code: 'SP-02', name: 'Pit Selatan', latitude: -3.78421, longitude: 115.60214, is_active: true,
  thresholds: { ph_outlet: { min: 6, max: 9 }, tss_outlet: { min: null, max: 40 } },
};
export const POND_B = { id: 'p2', code: 'SP-01', name: 'Pit Utara', latitude: null, longitude: null, is_active: true, thresholds: {} };

export const emptyDay = {
  weather: null, water: null,
  coagulant: { 'Tawas Serbuk': null, 'Tawas Batu': null, Kapur: null },
  previousRemaining: { 'Tawas Serbuk': null, 'Tawas Batu': null, Kapur: null },
};

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;
export type Call = { url: string; method: string; body: any };

/** Stubs fetch. `handler` can answer any /api path; auth, ponds and an empty day have defaults. */
export function mockApi(opts: { role?: Role; name?: string; ponds?: unknown[]; handler?: Handler } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const raw = init?.body;
    const body = raw instanceof FormData
      ? { formData: Object.fromEntries([...raw.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : { name: v.name, size: v.size, type: v.type }])) }
      : raw ? JSON.parse(String(raw)) : undefined;
    calls.push({ url, method: init?.method ?? 'GET', body });
    const custom = opts.handler?.(url, init);
    if (custom) return custom;
    if (url.startsWith('/api/auth/me')) return new Response(JSON.stringify({ id: 'u1', name: opts.name ?? 'Rudi Hartono', role: opts.role ?? 'Operator' }));
    if (url.startsWith('/api/events?')) return new Response(JSON.stringify({ today: '2026-11-02', events: [] }));
    if (url.startsWith('/api/events/summary')) return new Response(JSON.stringify({ today: '2026-11-02', overdue: 0, due_today: 0 }));
    if (url.startsWith('/api/ponds')) return new Response(JSON.stringify(opts.ponds ?? [POND, POND_B]));
    if (url.startsWith('/api/day')) return new Response(JSON.stringify(emptyDay));
    if (init?.method === 'PUT') return new Response(JSON.stringify({ ok: true }));
    return new Response('{}');
  }));
  return calls;
}

export const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });

export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider>
    </MemoryRouter>,
  );
}

/** /api/ponds fails the first time, then works. Returns a handler for mockApi. */
export function pondsFailOnce(): Handler {
  let n = 0;
  return (url) => (url.startsWith('/api/ponds') && n++ === 0 ? json({ error: 'Terjadi kesalahan. Coba lagi.' }, 500) : undefined);
}
