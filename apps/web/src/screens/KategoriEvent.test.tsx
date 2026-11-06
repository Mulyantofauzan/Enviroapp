import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CATEGORY_PALETTE } from '@evo/shared';
import { json, mockApi, renderApp } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

const P = CATEGORY_PALETTE;
const LIST = [
  { id: 'k1', name: 'Air', color: P[0], is_active: true, event_count: 3 },
  { id: 'k2', name: 'Lama', color: P[1], is_active: false, event_count: 0 },
];
const changes = (calls: { method: string; url: string; body: any }[]) => calls.filter((c) => c.method !== 'GET');

function setup(role: 'Manager' | 'Admin' | 'Operator' = 'Manager', extra?: (u: string, i?: RequestInit) => Response | undefined) {
  return mockApi({
    role,
    handler: (u, i) => {
      if (u.startsWith('/api/event-categories') && (i?.method ?? 'GET') === 'GET') return json(LIST);
      if (u.startsWith('/api/events/summary')) return json({ today: '2026-11-02', overdue: 0, due_today: 0 });
      return extra?.(u, i);
    },
  });
}

describe('Kategori Event', () => {
  it('lists each category with its color, active events and status', async () => {
    setup();
    renderApp('/kalender/kategori');
    const air = await screen.findByRole('article', { name: 'Air' });
    expect(within(air).getByText('3 event aktif')).toBeInTheDocument();
    expect(within(air).getByText('Aktif')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Lama' })).getByText('Nonaktif')).toBeInTheDocument();
  });
  it('adds a category with the first palette color nobody active uses', async () => {
    const calls = setup();
    renderApp('/kalender/kategori');
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah kategori' }));
    await userEvent.type(screen.getByLabelText('Nama'), 'Udara');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(changes(calls)).toHaveLength(1));
    expect(changes(calls)[0]).toMatchObject({ method: 'POST', url: '/api/event-categories', body: { name: 'Udara', color: P[1] } });
  });
  it('offers all sixteen palette colors and changes a color', async () => {
    const calls = setup();
    renderApp('/kalender/kategori');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Air' }));
    expect(screen.getAllByRole('button', { name: /^Warna #/ })).toHaveLength(16);
    expect(screen.getByRole('button', { name: `Warna ${P[0]}` })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: `Warna ${P[5]}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(changes(calls)).toHaveLength(1));
    expect(changes(calls)[0]).toMatchObject({ method: 'PATCH', url: '/api/event-categories/k1', body: { name: 'Air', color: P[5] } });
  });
  it('deactivates and reactivates', async () => {
    const calls = setup();
    renderApp('/kalender/kategori');
    await userEvent.click(await screen.findByRole('button', { name: 'Nonaktifkan Air' }));
    await waitFor(() => expect(changes(calls)).toHaveLength(1));
    expect(changes(calls)[0]).toMatchObject({ method: 'PATCH', url: '/api/event-categories/k1', body: { is_active: false } });
    await userEvent.click(await screen.findByRole('button', { name: 'Aktifkan Lama' }));
    await waitFor(() => expect(changes(calls)).toHaveLength(2));
    expect(changes(calls)[1].body).toEqual({ is_active: true });
  });
  it('shows the reason when the name is already taken', async () => {
    setup('Manager', (u, i) => (i?.method === 'POST' ? json({ error: 'Nama kategori sudah dipakai.' }, 409) : undefined));
    renderApp('/kalender/kategori');
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah kategori' }));
    await userEvent.type(screen.getByLabelText('Nama'), 'air');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(await screen.findByText('Nama kategori sudah dipakai.')).toBeInTheDocument();
  });
  it('an operator is sent away', async () => {
    setup('Operator');
    renderApp('/kalender/kategori');
    await screen.findByRole('heading', { name: /Halo/ });
    expect(screen.queryByRole('button', { name: 'Tambah kategori' })).toBeNull();
  });
});
