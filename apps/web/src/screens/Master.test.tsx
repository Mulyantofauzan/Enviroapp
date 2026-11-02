import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp, POND, POND_B } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());
const sent = (calls: { method: string; url: string; body: any }[]) => calls.filter((c) => c.method === 'PATCH' || c.method === 'POST');

describe('Master Data Settling Pond', () => {
  it('lists ponds as "kode nama" with status chips', async () => {
    mockApi({ role: 'Admin', ponds: [POND, { ...POND_B, is_active: false }] });
    renderApp('/master');
    expect(await screen.findByText('SP-02 Pit Selatan')).toBeInTheDocument();
    expect(screen.getByText('SP-01 Pit Utara')).toBeInTheDocument();
    expect(screen.getByText('Aktif')).toBeInTheDocument();
    expect(screen.getByText('Nonaktif')).toBeInTheDocument();
  });
  it('opens the edit form with the saved values', async () => {
    mockApi({ role: 'Admin' });
    renderApp('/master');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah SP-02 Pit Selatan' }));
    expect(screen.getByLabelText('Kode')).toHaveValue('SP-02');
    expect(screen.getByLabelText('Nama')).toHaveValue('Pit Selatan');
    expect(screen.getByLabelText('pH minimum')).toHaveValue('6');
    expect(screen.getByLabelText('TSS maksimum (mg/L)')).toHaveValue('40');
    expect(screen.getByLabelText('Latitude')).toHaveValue('-3,78421');
  });
  it('saves changed limits with PATCH, blank bound as null', async () => {
    const calls = mockApi({ role: 'Admin' });
    renderApp('/master');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah SP-02 Pit Selatan' }));
    const ph = screen.getByLabelText('pH minimum');
    await userEvent.clear(ph);
    await userEvent.type(ph, '5,5');
    await userEvent.clear(screen.getByLabelText('TSS maksimum (mg/L)'));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(sent(calls)).toHaveLength(1));
    expect(sent(calls)[0]).toMatchObject({ method: 'PATCH', url: '/api/ponds/p1' });
    expect(sent(calls)[0].body.thresholds).toEqual({ ph_outlet: { min: 5.5, max: 9 }, tss_outlet: { min: null, max: null } });
  });
  it('shows the placeholder for an empty TSS limit', async () => {
    mockApi({ role: 'Admin', ponds: [{ ...POND, thresholds: {} }] });
    renderApp('/master');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah SP-02 Pit Selatan' }));
    expect(screen.getByLabelText('TSS maksimum (mg/L)')).toHaveAttribute('placeholder', '[isi sesuai izin lingkungan]');
  });
  it('adds a pond with POST', async () => {
    const calls = mockApi({ role: 'Admin' });
    renderApp('/master');
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah Settling Pond' }));
    await userEvent.type(screen.getByLabelText('Kode'), 'SP-03');
    await userEvent.type(screen.getByLabelText('Nama'), 'Disposal Barat');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(sent(calls)).toHaveLength(1));
    expect(sent(calls)[0]).toMatchObject({ method: 'POST', url: '/api/ponds' });
    expect(sent(calls)[0].body).toMatchObject({ code: 'SP-03', name: 'Disposal Barat' });
  });
  it('turning the switch off sends is_active false', async () => {
    const calls = mockApi({ role: 'Admin' });
    renderApp('/master');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah SP-02 Pit Selatan' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Settling Pond aktif' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(sent(calls)).toHaveLength(1));
    expect(sent(calls)[0].body.is_active).toBe(false);
  });
  it('a server conflict is shown in plain words', async () => {
    mockApi({ role: 'Admin', handler: (u, i) => (i?.method === 'PATCH' ? json({ error: 'Kode atau nama sudah dipakai.' }, 409) : undefined) });
    renderApp('/master');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah SP-02 Pit Selatan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(await screen.findByText('Kode atau nama sudah dipakai.')).toBeInTheDocument();
  });
  it('text in a coordinate blocks the save', async () => {
    const calls = mockApi({ role: 'Admin' });
    renderApp('/master');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah SP-02 Pit Selatan' }));
    const lat = screen.getByLabelText('Latitude');
    await userEvent.clear(lat);
    await userEvent.type(lat, 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(await screen.findByText('Perbaiki angka yang ditandai dulu.')).toBeInTheDocument();
    expect(sent(calls)).toHaveLength(0);
  });
  it('cancel closes the form without saving', async () => {
    const calls = mockApi({ role: 'Admin' });
    renderApp('/master');
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah SP-02 Pit Selatan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.queryByLabelText('Kode')).toBeNull();
    expect(sent(calls)).toHaveLength(0);
  });
});
