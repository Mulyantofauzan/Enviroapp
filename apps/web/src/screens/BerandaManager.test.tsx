import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pondsFailOnce, json, mockApi, renderApp } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

const series = (n: number, fill = true) =>
  Array.from({ length: n }, (_, i) => ({ date: `2026-10-${String(30 - n + i + 1).padStart(2, '0')}`, ph_inlet: fill ? 6.2 : null, ph_outlet: fill ? 7.1 : null }));
const base = {
  date: '2026-11-02', days: 7,
  today: { ph_outlet: 5.8, tss_outlet: 38, debit_outlet_m3s: 0.0148, debit_outlet_m3d: 1278.72, rainfall_mm: 12.5, rain_hours: 3.5 },
  series: series(7),
  coagulant: { Kapur: { remaining: 260, max: 260, updated: '2026-11-02' }, 'Tawas Serbuk': { remaining: 87.5, max: 260, updated: '2026-11-02' }, 'Tawas Batu': { remaining: 130, max: 260, updated: '2026-11-02' } },
  thresholds: { ph_outlet: { min: 6, max: 9 }, tss_outlet: { min: null, max: 40 } },
};
const dash = (over: object = {}, onUrl?: (u: string) => void) => (u: string) => {
  if (!u.startsWith('/api/dashboard')) return undefined;
  onUrl?.(u);
  return json({ ...base, ...over });
};

describe('Dashboard Manager', () => {
  it('shows today cards with verdicts from the pond limits', async () => {
    mockApi({ role: 'Manager', name: 'Sinta Maharani', handler: dash() });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    const ph = await screen.findByRole('group', { name: 'pH Outlet hari ini' });
    expect(within(ph).getByText('5,8')).toBeInTheDocument();
    expect(within(ph).getByText('Abnormal')).toBeInTheDocument();
    const tss = screen.getByRole('group', { name: 'TSS Outlet' });
    expect(within(tss).getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('1.278,7')).toBeInTheDocument();
    expect(screen.getByText('Dari 0,0148 m³/s')).toBeInTheDocument();
    expect(screen.getByText('12,5')).toBeInTheDocument();
    expect(screen.getByText('3,5 jam hujan')).toBeInTheDocument();
  });
  it('asks for 7 days first and 30 when chosen', async () => {
    const urls: string[] = [];
    mockApi({ role: 'Manager', handler: dash({}, (u) => urls.push(u)) });
    renderApp('/');
    await screen.findByRole('group', { name: 'pH Outlet hari ini' });
    expect(urls.some((u) => u.includes('days=7'))).toBe(true);
    await userEvent.click(screen.getByRole('tab', { name: '30 hari' }));
    await screen.findByRole('group', { name: 'pH Outlet hari ini' });
    expect(urls.some((u) => u.includes('days=30'))).toBe(true);
  });
  it('draws the chart and the stock bars', async () => {
    mockApi({ role: 'Manager', handler: dash() });
    renderApp('/');
    expect(await screen.findByRole('img', { name: /pH inlet dan outlet/ })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Kapur' })).toBeInTheDocument();
  });
  it('no data today: says so and shows no verdict', async () => {
    mockApi({ role: 'Manager', handler: dash({ today: null }) });
    renderApp('/');
    expect(await screen.findByText('Belum ada data hari ini.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'pH Outlet hari ini' })).toBeNull();
    expect(screen.queryByText('Normal')).toBeNull();
  });
  it('no pH in the range: honest empty message instead of a chart', async () => {
    mockApi({ role: 'Manager', handler: dash({ series: series(7, false), today: null }) });
    renderApp('/');
    expect(await screen.findByText('Belum ada data pH pada rentang ini.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /pH inlet dan outlet/ })).toBeNull();
  });
  it('is read-only: no save button, no edit', async () => {
    mockApi({ role: 'Manager', handler: dash() });
    renderApp('/');
    await screen.findByRole('group', { name: 'pH Outlet hari ini' });
    expect(screen.queryByRole('button', { name: /Simpan/ })).toBeNull();
  });
  it('a failed load shows the error', async () => {
    mockApi({ role: 'Manager', handler: (u) => (u.startsWith('/api/dashboard') ? json({ error: 'Terjadi kesalahan. Coba lagi.' }, 500) : undefined) });
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan. Coba lagi.');
  });
});

describe('BerandaManager when the pond list fails to load', () => {
  it('names the failure and offers a retry instead of saying there are no ponds', async () => {
    const failOnce = pondsFailOnce();
    mockApi({ role: 'Manager', handler: (u, i) => failOnce(u, i) ?? dash()(u) });
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan. Coba lagi.');
    expect(screen.queryByText(/Belum ada settling pond aktif/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('combobox', { name: /Settling Pond/ })).toBeInTheDocument();
  });
});

describe('Dashboard: TSS, rainfall and calendar overview', () => {
  const DATES = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
  const days = (fill = true) => DATES.map((date, i) => ({
    date,
    ph_inlet: fill ? 6.2 : null, ph_outlet: fill ? 7.1 : null,
    tss_inlet: fill ? 120 : null, tss_outlet: fill ? (i === 6 ? 55 : 30) : null, rainfall_mm: fill ? (i === 6 ? 12.5 : 2) : null,
  }));
  const payload = (fill = true) => ({ ...base, series: days(fill), thresholds: { ph_outlet: { min: 6, max: 9 }, tss_outlet: { min: null, max: 40 } } });
  const handler = (fill = true, extra?: (u: string) => Response | undefined) => (u: string) =>
    extra?.(u) ?? (u.startsWith('/api/dashboard') ? json(payload(fill)) : undefined);

  it('shows pH, TSS, rainfall and stock together', async () => {
    mockApi({ role: 'Manager', handler: handler() });
    renderApp('/');
    expect(await screen.findByRole('img', { name: /Grafik pH inlet dan outlet/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Grafik TSS inlet dan outlet/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Grafik curah hujan/ })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Kapur' })).toBeInTheDocument();
  });
  it('TSS above the pond limit is marked on the chart', async () => {
    mockApi({ role: 'Manager', handler: handler() });
    const { container } = renderApp('/');
    await screen.findByRole('img', { name: /Grafik TSS inlet dan outlet/ });
    expect(container.querySelectorAll('circle[data-abnormal]').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Baku mutu (maks. 40)')).toBeInTheDocument();
  });
  it('each chart has its own honest empty message', async () => {
    mockApi({ role: 'Manager', handler: handler(false) });
    renderApp('/');
    expect(await screen.findByText('Belum ada data pH pada rentang ini.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada data TSS pada rentang ini.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada data curah hujan pada rentang ini.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Grafik/ })).toBeNull();
  });
  it('the Admin home is the same dashboard, titled for the Admin', async () => {
    mockApi({ role: 'Admin', handler: handler() });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText(/Admin System/)).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /Grafik TSS inlet dan outlet/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Grafik curah hujan/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Air Permukaan/ })).toBeNull();
  });
  it('the Operator home is still the shortcuts, not the dashboard', async () => {
    mockApi({ role: 'Operator', handler: handler() });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /Halo, Rudi/ })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Grafik/ })).toBeNull();
  });
  it('shows this month\'s calendar with the overdue count and a way into the calendar', async () => {
    const events = [{ schedule_id: 's1', title: 'Cek', description: null, frequency: 'Daily', sp_id: null, assigned_to_name: null, due_date: '2026-11-01', status: 'overdue', late: false, evidence_count: 0, completed_at: null, completed_by_name: null },
      { schedule_id: 's1', title: 'Cek', description: null, frequency: 'Daily', sp_id: null, assigned_to_name: null, due_date: '2026-11-10', status: 'upcoming', late: false, evidence_count: 0, completed_at: null, completed_by_name: null }];
    mockApi({
      role: 'Admin',
      handler: handler(true, (u) => (u.startsWith('/api/events/summary') ? json({ today: '2026-11-02', overdue: 2, due_today: 1 })
        : u.startsWith('/api/events?') ? json({ today: '2026-11-02', events }) : undefined)),
    });
    renderApp('/');
    const card = await screen.findByRole('region', { name: 'Kalender bulan ini' });
    expect(within(card).getByText('November 2026')).toBeInTheDocument();
    expect(await within(card).findByText(/2026-11-01|ada overdue/)).toBeInTheDocument();
    expect(within(card).getByText('2 event overdue')).toBeInTheDocument();
    expect(within(card).getByText('1 event hari ini')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Buka Kalender' })).toHaveAttribute('href', '/kalender');
    expect(within(card).getByTestId('day-2026-11-10')).toHaveAttribute('data-mark', 'scheduled');
    expect(within(card).queryAllByRole('button')).toHaveLength(0);
  });
  it('a failing calendar summary hides the card without breaking the dashboard', async () => {
    mockApi({ role: 'Manager', handler: handler(true, (u) => (u.startsWith('/api/events') ? json({ error: 'x' }, 500) : undefined)) });
    renderApp('/');
    expect(await screen.findByRole('img', { name: /Grafik pH inlet dan outlet/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Kalender bulan ini' })).toBeNull();
  });
});
