import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { json, mockApi, renderApp, POND } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

const entry = {
  date: '2026-11-02', sp_id: 'p1', weather: { rainfall_mm: 12.5, rain_hours: 3.5 },
  water: { ph_inlet: 3, ph_outlet: 5.2, tss_inlet: 10, tss_outlet: 38, debit_inlet_m3d: 86400, debit_outlet_m3d: 1278.7 },
  coagulant: [{ type: 'Kapur', stock_in: 0, stock_out: 2, stock_remaining: 5, staleRemaining: true }],
};
const api = (entries: unknown[] = [entry]) => (u: string) => (u.startsWith('/api/history') ? json(entries) : undefined);

describe('Riwayat', () => {
  it('highlights outlet values outside the pond limits, never inlet', async () => {
    mockApi({ handler: api() });
    renderApp('/riwayat');
    expect(await screen.findByText('5,2')).toHaveClass('is-bad');
    expect(screen.getByText('38')).not.toHaveClass('is-bad');
    expect(screen.getByText('3')).not.toHaveClass('is-bad');
  });
  it('marks stock that differs from the day before', async () => {
    mockApi({ handler: api() });
    renderApp('/riwayat');
    expect(await screen.findByText('Selisih hitungan stok dengan hari sebelumnya')).toBeInTheDocument();
  });
  it('shows pond code and name and an id-ID date', async () => {
    mockApi({ handler: api() });
    renderApp('/riwayat');
    expect(await screen.findByText('Senin, 2 Nov 2026')).toBeInTheDocument();
    expect(screen.getAllByText('SP-02 Pit Selatan').length).toBeGreaterThan(0);
  });
  it('a writer can open the day to edit it', async () => {
    mockApi({ handler: api() });
    renderApp('/riwayat');
    expect(await screen.findByRole('link', { name: /Senin, 2 Nov 2026/ })).toHaveAttribute('href', '/input/air?date=2026-11-02&sp=p1');
  });
  it('an auditor reads but cannot open the edit screens', async () => {
    mockApi({ role: 'Auditor', handler: api() });
    renderApp('/riwayat');
    await screen.findByText('5,2');
    expect(screen.queryByRole('link', { name: /Senin, 2 Nov 2026/ })).toBeNull();
  });
  it('empty range says so', async () => {
    mockApi({ handler: api([]) });
    renderApp('/riwayat');
    expect(await screen.findByText('Tidak ada data pada rentang ini.')).toBeInTheDocument();
  });
  it('a pond switched off still shows its history', async () => {
    mockApi({ ponds: [{ ...POND, is_active: false }], handler: api() });
    renderApp('/riwayat');
    expect(await screen.findByText('5,2')).toBeInTheDocument();
  });
  it('error is shown', async () => {
    mockApi({ handler: (u) => (u.startsWith('/api/history') ? json({ error: 'Pilih rentang tanggal yang benar.' }, 400) : undefined) });
    renderApp('/riwayat');
    expect(await screen.findByRole('alert')).toHaveTextContent('Pilih rentang tanggal yang benar.');
  });
});
