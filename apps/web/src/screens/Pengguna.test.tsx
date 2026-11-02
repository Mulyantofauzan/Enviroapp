import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

const users = [
  { id: 'u1', name: 'Andi Wijaya', email: 'andi.wijaya@evo.example', role: 'Admin', is_active: true },
  { id: 'u2', name: 'Sinta Maharani', email: 'sinta.maharani@evo.example', role: 'Manager', is_active: true },
  { id: 'u3', name: 'Rudi Hartono', email: 'rudi.hartono@evo.example', role: 'Operator', is_active: true },
  { id: 'u4', name: 'Bagas Prakoso', email: 'bagas.prakoso@evo.example', role: 'Operator', is_active: false },
  { id: 'u5', name: 'Dewi Lestari', email: 'dewi.lestari@evo.example', role: 'Auditor', is_active: true },
];
const withUsers = (over?: (u: string, i?: RequestInit) => Response | undefined) => (u: string, i?: RequestInit) =>
  over?.(u, i) ?? (u.startsWith('/api/users') && (i?.method ?? 'GET') === 'GET' ? json(users) : undefined);
const changes = (calls: { method: string }[]) => calls.filter((c) => c.method !== 'GET');

describe('Kelola Pengguna', () => {
  it('lists everyone with a count', async () => {
    mockApi({ role: 'Admin', handler: withUsers() });
    renderApp('/pengguna');
    expect(await screen.findByText('5 pengguna')).toBeInTheDocument();
    expect(screen.getByText('Dewi Lestari')).toBeInTheDocument();
    expect(screen.getByText('dewi.lestari@evo.example')).toBeInTheDocument();
  });
  it('search matches name or email, ignoring case', async () => {
    mockApi({ role: 'Admin', handler: withUsers() });
    renderApp('/pengguna');
    await screen.findByText('5 pengguna');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Cari nama atau email' }), 'DEWI');
    expect(screen.getByText('1 pengguna')).toBeInTheDocument();
    expect(screen.queryByText('Andi Wijaya')).toBeNull();
  });
  it('role filter narrows the list', async () => {
    mockApi({ role: 'Admin', handler: withUsers() });
    renderApp('/pengguna');
    await screen.findByText('5 pengguna');
    await userEvent.click(screen.getByRole('tab', { name: 'Operator' }));
    expect(screen.getByText('2 pengguna')).toBeInTheDocument();
    expect(screen.queryByText('Andi Wijaya')).toBeNull();
  });
  it('the switch shows state and turning it on sends is_active true', async () => {
    const calls = mockApi({ role: 'Admin', handler: withUsers() });
    renderApp('/pengguna');
    const sw = await screen.findByRole('switch', { name: 'Aktif: Bagas Prakoso' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    await waitFor(() => expect(changes(calls)).toHaveLength(1));
    expect(changes(calls)[0]).toMatchObject({ method: 'PATCH', url: '/api/users/u4', body: { is_active: true } });
  });
  it('shows the API reason when the last admin cannot be changed', async () => {
    mockApi({ role: 'Admin', handler: withUsers((u, i) => (i?.method === 'PATCH' ? json({ error: 'Harus ada minimal satu admin aktif.' }, 409) : undefined)) });
    renderApp('/pengguna');
    await userEvent.click(await screen.findByRole('switch', { name: 'Aktif: Andi Wijaya' }));
    expect(await screen.findByText('Harus ada minimal satu admin aktif.')).toBeInTheDocument();
  });
  it('adds a user with POST', async () => {
    const calls = mockApi({ role: 'Admin', handler: withUsers() });
    renderApp('/pengguna');
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah' }));
    await userEvent.type(screen.getByLabelText('Nama'), 'Budi');
    await userEvent.type(screen.getByLabelText('Email'), 'budi@evo.example');
    await userEvent.type(screen.getByLabelText('Kata sandi'), 'rahasia-123');
    await userEvent.selectOptions(screen.getByLabelText('Peran'), 'Manager');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan pengguna' }));
    await waitFor(() => expect(changes(calls)).toHaveLength(1));
    expect(changes(calls)[0]).toMatchObject({ method: 'POST', url: '/api/users', body: { name: 'Budi', email: 'budi@evo.example', role: 'Manager' } });
  });
  it('role matrix: Admin has every function', async () => {
    mockApi({ role: 'Admin', handler: withUsers() });
    renderApp('/pengguna');
    const table = await screen.findByRole('table', { name: 'Hak akses peran' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(6);
    for (const r of rows) expect(within(within(r).getAllByRole('cell')[1]).getByRole('img', { name: 'Ya' })).toBeInTheDocument();
    expect(screen.getByText(/Admin punya akses penuh/)).toBeInTheDocument();
  });
  it('each role keeps its own main function in the matrix', async () => {
    mockApi({ role: 'Admin', handler: withUsers() });
    renderApp('/pengguna');
    const table = await screen.findByRole('table', { name: 'Hak akses peran' });
    const row = within(table).getByRole('row', { name: /Dashboard dan laporan/ });
    const cells = within(row).getAllByRole('cell');
    expect(within(cells[2]).getByRole('img', { name: 'Ya' })).toBeInTheDocument();
    expect(within(cells[3]).queryByRole('img', { name: 'Ya' })).toBeNull();
  });
});
