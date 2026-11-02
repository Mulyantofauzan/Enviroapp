import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { History } from './History';
import { AuthProvider } from '../auth/AuthContext';
import { App } from '../App';

afterEach(() => vi.unstubAllGlobals());

function mockFetch(routes: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const key = Object.keys(routes).find((k) => url.startsWith(`/api${k}`));
    return key ? new Response(JSON.stringify(routes[key]), { status: 200 }) : new Response('{"error":"nope"}', { status: 404 });
  }));
}

const entry = {
  date: '2026-11-02', sp_id: 'p1', weather: null,
  water: { ph_inlet: 7, ph_outlet: 5.2, tss_inlet: 10, tss_outlet: 10, debit_inlet_m3s: 1, debit_outlet_m3s: 1, debit_inlet_m3d: 86400, debit_outlet_m3d: 86400 },
  coagulant: [{ type: 'Kapur', stock_in: 0, stock_out: 2, stock_remaining: 5, staleRemaining: true }],
};

describe('History', () => {
  it('marks stale stock and flags out-of-limit values', async () => {
    mockFetch({
      '/history': [entry],
      '/ponds': [{ id: 'p1', name: 'SP 1', is_active: true }],
      '/thresholds': { ph_outlet: { min: 6, max: 9 } },
    });
    render(<MemoryRouter><History /></MemoryRouter>);
    expect(await screen.findByText('Stock count differs from earlier edits')).toBeInTheDocument();
    const alert = await waitFor(() => {
      const el = screen.getByText('5.2');
      expect(el).toHaveClass('is-alert');
      return el;
    });
    expect(alert).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveTextContent('SP 1');
  });
  it('says so when there is no data', async () => {
    mockFetch({ '/history': [], '/ponds': [], '/thresholds': {} });
    render(<MemoryRouter><History /></MemoryRouter>);
    expect(await screen.findByText('No entries in this range.')).toBeInTheDocument();
  });
});

describe('admin route guard', () => {
  it('redirects a non-admin away from /admin', async () => {
    mockFetch({
      '/auth/me': { id: 'u', name: 'Op', role: 'Operator' },
      '/ponds': [], '/thresholds': {}, '/history': [],
    });
    render(<MemoryRouter initialEntries={['/admin']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    await screen.findByText(/Sign out/);
    expect(screen.queryByText('Users')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });
});
