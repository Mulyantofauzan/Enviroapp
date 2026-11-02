import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { ToastProvider } from '../components/Toast';
import { Today } from './Today';

afterEach(() => vi.unstubAllGlobals());

const PONDS = [{ id: 'A', name: 'SP A', is_active: true }, { id: 'B', name: 'SP B', is_active: true }];
const emptyDay = {
  weather: null, water: null,
  coagulant: { 'Tawas Serbuk': null, 'Tawas Batu': null, Kapur: null },
  previousRemaining: { 'Tawas Serbuk': null, 'Tawas Batu': null, Kapur: null },
};

function setup(route: string, day: (url: string) => Promise<Response> | Response = () => new Response(JSON.stringify(emptyDay))) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url.startsWith('/api/auth/me')) return new Response(JSON.stringify({ id: 'u', name: 'Op', role: 'Operator' }));
    if (url.startsWith('/api/ponds')) return new Response(JSON.stringify(PONDS));
    if (url.startsWith('/api/thresholds')) return new Response('{}');
    if (url.startsWith('/api/day')) return day(url);
    return new Response('{}');
  }));
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider><ToastProvider><Today /></ToastProvider></AuthProvider>
    </MemoryRouter>,
  );
  return calls;
}

describe('Today', () => {
  it('hides Save and the form while a day is loading, so old numbers cannot go to the new pond', async () => {
    setup('/?date=2026-11-02&sp=A', (url) => (url.includes('sp=B') ? new Promise<Response>(() => {}) : new Response(JSON.stringify(emptyDay))));
    await userEvent.type(await screen.findByLabelText('Rainfall'), '5');
    await userEvent.click(screen.getByRole('tab', { name: 'SP B' }));
    expect(screen.queryByRole('button', { name: 'Save day' })).toBeNull();
    expect(screen.queryByLabelText('Rainfall')).toBeNull();
  });

  it('a failed load shows the error and no Save button', async () => {
    setup('/?date=2026-11-02&sp=A', () => new Response(JSON.stringify({ error: 'No connection. Try again.' }), { status: 500 }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No connection. Try again.');
    expect(screen.queryByRole('button', { name: 'Save day' })).toBeNull();
  });

  it('refuses to save while a number box holds text, and says which box', async () => {
    const calls = setup('/?date=2026-11-02&sp=A');
    await userEvent.type(await screen.findByLabelText('pH inlet'), 'abc');
    expect(screen.getByText('Enter a number')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save day' }));
    expect(await screen.findByText('Fix the highlighted numbers first.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('opens a day for a pond that is not active as read-only', async () => {
    setup('/?date=2026-11-02&sp=GONE');
    expect(await screen.findByText(/pond is switched off/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save day' })).toBeNull();
  });

  it('saves the day to the selected pond', async () => {
    const calls = setup('/?date=2026-11-02&sp=A');
    await userEvent.type(await screen.findByLabelText('pH inlet'), '7');
    await userEvent.click(screen.getByRole('button', { name: 'Save day' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT' && c.url === '/api/water/2026-11-02/A')).toBe(true));
  });
});
