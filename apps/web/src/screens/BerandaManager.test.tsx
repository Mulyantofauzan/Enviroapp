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
