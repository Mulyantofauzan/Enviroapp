import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp, POND } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

const water = (over: Record<string, unknown> = {}) => ({ ph_inlet: 3, ph_outlet: 5.2, tss_inlet: 10, tss_outlet: 38, debit_inlet_m3d: 86400, debit_outlet_m3d: 1278.7, ...over });
const e1 = {
  date: '2026-11-02', sp_id: 'p1', weather: { rainfall_mm: 12.5, rain_hours: 3.5 }, water: water(),
  coagulant: [{ type: 'Kapur', stock_in: 0, stock_out: 2, stock_remaining: 5, staleRemaining: true }],
};
const e2 = { date: '2026-11-02', sp_id: 'p2', weather: { rainfall_mm: 12.5, rain_hours: 3.5 }, water: water({ ph_outlet: 4 }), coagulant: [] };
const e3 = { date: '2026-11-01', sp_id: 'p1', weather: null, water: null, coagulant: [{ type: 'Tawas Batu', stock_in: 1, stock_out: 0, stock_remaining: 1, staleRemaining: false }] };
const api = (entries: unknown[] = [e1, e2, e3]) => (u: string) => (u.startsWith('/api/history') ? json(entries) : undefined);
const POND2 = { id: 'p2', code: 'SP-01', name: 'Pit Utara', latitude: null, longitude: null, is_active: true, thresholds: {} };

describe('Riwayat table: Air permukaan', () => {
  it('is a table with the water columns, newest first', async () => {
    mockApi({ ponds: [POND, POND2], handler: api() });
    renderApp('/riwayat');
    const table = await screen.findByRole('table', { name: 'Air permukaan' });
    const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(['Tanggal', 'Pond', 'pH inlet', 'pH outlet', 'TSS inlet', 'TSS outlet', 'Debit inlet (m³/d)', 'Debit outlet (m³/d)', 'Aksi']);
    expect(within(table).getAllByRole('row')).toHaveLength(3); // header + 2 rows with water
  });
  it('marks outlet values outside that pond\'s limits, never inlet, never when no limits are set', async () => {
    mockApi({ ponds: [POND, POND2], handler: api() });
    renderApp('/riwayat');
    const table = await screen.findByRole('table', { name: 'Air permukaan' });
    expect(within(table).getByRole('cell', { name: '5,2' })).toHaveClass('is-bad');
    for (const c of within(table).getAllByRole('cell', { name: '38' })) expect(c).not.toHaveClass('is-bad');
    expect(within(table).getByRole('cell', { name: '4' })).not.toHaveClass('is-bad');
    for (const c of within(table).getAllByRole('cell', { name: '3' })) expect(c).not.toHaveClass('is-bad');
  });
  it('formats numbers the Indonesian way and empty cells as a dash', async () => {
    mockApi({ ponds: [POND], handler: api([{ ...e1, water: water({ tss_inlet: null }) }]) });
    renderApp('/riwayat');
    const table = await screen.findByRole('table', { name: 'Air permukaan' });
    expect(within(table).getByRole('cell', { name: '1.278,7' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '–' })).toBeInTheDocument();
  });
  it('shows the short pond code in the table (full name stays in the edit link), and the date with its year', async () => {
    mockApi({ ponds: [POND], handler: api([e1]) });
    renderApp('/riwayat');
    const table = await screen.findByRole('table', { name: 'Air permukaan' });
    expect(within(table).getByRole('cell', { name: 'SP-02' })).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Ubah 2 Nov 2026 SP-02 Pit Selatan' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '2 Nov 2026' })).toBeInTheDocument();
  });
  it('a pond that is switched off still shows its history', async () => {
    mockApi({ ponds: [{ ...POND, is_active: false }], handler: api([e1]) });
    renderApp('/riwayat');
    expect(await screen.findByRole('cell', { name: '5,2' })).toBeInTheDocument();
  });
});

describe('Riwayat table: Cuaca and Koagulan', () => {
  it('Cuaca has one row per date, not per pond', async () => {
    mockApi({ ponds: [POND, POND2], handler: api() });
    renderApp('/riwayat');
    await userEvent.click(await screen.findByRole('tab', { name: 'Cuaca' }));
    const table = await screen.findByRole('table', { name: 'Cuaca' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Tanggal', 'Rainfall (mm)', 'Rain hours (jam)', 'Aksi']);
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByRole('cell', { name: '12,5' })).toBeInTheDocument();
  });
  it('Koagulan has one row per type and flags stock that differs', async () => {
    mockApi({ ponds: [POND], handler: api() });
    renderApp('/riwayat');
    await userEvent.click(await screen.findByRole('tab', { name: 'Koagulan' }));
    const table = await screen.findByRole('table', { name: 'Koagulan' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Tanggal', 'Pond', 'Jenis', 'Masuk', 'Keluar', 'Sisa', 'Aksi']);
    const kapur = within(table).getByRole('row', { name: /Kapur/ });
    expect(within(kapur).getByText('Selisih')).toBeInTheDocument();
    const batu = within(table).getByRole('row', { name: /Tawas Batu/ });
    expect(within(batu).queryByText('Selisih')).toBeNull();
  });
});

describe('Riwayat: edit links', () => {
  it('a writer can open the day to edit it, per tab', async () => {
    mockApi({ ponds: [POND], handler: api([e1, e3]) });
    renderApp('/riwayat');
    const air = await screen.findByRole('link', { name: 'Ubah 2 Nov 2026 SP-02 Pit Selatan' });
    expect(air).toHaveAttribute('href', '/input/air?date=2026-11-02&sp=p1');
    await userEvent.click(screen.getByRole('tab', { name: 'Cuaca' }));
    expect(await screen.findByRole('link', { name: 'Ubah 2 Nov 2026' })).toHaveAttribute('href', '/input/cuaca?date=2026-11-02');
    await userEvent.click(screen.getByRole('tab', { name: 'Koagulan' }));
    expect((await screen.findAllByRole('link', { name: /Ubah 2 Nov 2026 SP-02 Pit Selatan/ }))[0]).toHaveAttribute('href', '/input/air?date=2026-11-02&sp=p1');
  });
  it.each(['Manager', 'Auditor'] as const)('%s reads the table but has no edit links or action column', async (role) => {
    mockApi({ role, ponds: [POND], handler: api([e1]) });
    renderApp('/riwayat');
    const table = await screen.findByRole('table', { name: 'Air permukaan' });
    expect(within(table).queryByRole('link')).toBeNull();
    expect(within(table).queryByRole('columnheader', { name: 'Aksi' })).toBeNull();
  });
});

describe('Riwayat: states', () => {
  it('says so when the range has no data', async () => {
    mockApi({ handler: api([]) });
    renderApp('/riwayat');
    expect(await screen.findByText('Tidak ada data pada rentang ini.')).toBeInTheDocument();
  });
  it('a tab with nothing in it says so while others have data', async () => {
    mockApi({ ponds: [POND], handler: api([e3]) });
    renderApp('/riwayat');
    expect(await screen.findByText('Tidak ada data pada rentang ini.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Koagulan' }));
    expect(await screen.findByRole('table', { name: 'Koagulan' })).toBeInTheDocument();
  });
  it('shows the error', async () => {
    mockApi({ handler: (u) => (u.startsWith('/api/history') ? json({ error: 'Pilih rentang tanggal yang benar.' }, 400) : undefined) });
    renderApp('/riwayat');
    expect(await screen.findByRole('alert')).toHaveTextContent('Pilih rentang tanggal yang benar.');
  });
  it('the three views are tabs, Air permukaan first', async () => {
    mockApi({ handler: api([]) });
    renderApp('/riwayat');
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Air permukaan', 'Cuaca', 'Koagulan']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });
});
