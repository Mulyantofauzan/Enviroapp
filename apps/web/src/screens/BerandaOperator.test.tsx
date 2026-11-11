import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { pondsFailOnce, json, mockApi, renderApp, emptyDay, POND } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

const water = { ph_inlet: 6.8, ph_outlet: 5.8, tss_inlet: 90, tss_outlet: 38, debit_inlet_m3s: 0.02, debit_outlet_m3s: 0.0148, debit_inlet_m3d: 1728, debit_outlet_m3d: 1278.72 };

describe('Beranda Operator', () => {
  it('greets by first name with role and date', async () => {
    mockApi();
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Halo, Rudi' })).toBeInTheDocument();
    expect(screen.getByText(/Operator Lapangan - /)).toBeInTheDocument();
  });
  it('shows today values with Abnormal / Normal chips from the pond limits', async () => {
    mockApi({ handler: (u) => (u.startsWith('/api/day') ? json({ ...emptyDay, water }) : undefined) });
    renderApp('/');
    const card = await screen.findByRole('region', { name: /Data hari ini/ });
    expect(await within(card).findByText('5,8')).toBeInTheDocument();
    expect(within(card).getByText('Abnormal')).toBeInTheDocument();
    expect(within(card).getByText('38')).toBeInTheDocument();
    expect(within(card).getByText('Normal')).toBeInTheDocument();
    expect(within(card).getByText('14,8')).toBeInTheDocument();
  });
  it('a no-flow day shows No flow instead of an Abnormal verdict', async () => {
    mockApi({ handler: (u) => (u.startsWith('/api/day') ? json({ ...emptyDay, water: { ...water, ph_outlet: 0, tss_outlet: 0, debit_outlet_m3s: 0 } }) : undefined) });
    renderApp('/');
    const card = await screen.findByRole('region', { name: /Data hari ini/ });
    expect((await within(card).findAllByText('No flow')).length).toBeGreaterThan(0);
    expect(within(card).queryByText('Abnormal')).toBeNull();
  });
  it('shows no verdict chip when the pond has no limits set', async () => {
    mockApi({
      ponds: [{ ...POND, thresholds: {} }],
      handler: (u) => (u.startsWith('/api/day') ? json({ ...emptyDay, water }) : undefined),
    });
    renderApp('/');
    const card = await screen.findByRole('region', { name: /Data hari ini/ });
    expect(await within(card).findByText('5,8')).toBeInTheDocument();
    expect(within(card).queryByText('Abnormal')).toBeNull();
    expect(within(card).queryByText('Normal')).toBeNull();
  });
  it('says so when there is no water data today and offers the way to add it', async () => {
    mockApi();
    renderApp('/');
    expect(await screen.findByText('Belum ada data air hari ini.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Isi data air' })).toHaveAttribute('href', '/input/air');
  });
  it('module tiles open the input screens', async () => {
    mockApi();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Halo, Rudi' });
    expect(screen.getByRole('link', { name: /Cuaca/ })).toHaveAttribute('href', '/input/cuaca');
    expect(screen.getByRole('link', { name: /Air & Koagulan/ })).toHaveAttribute('href', '/input/air');
    expect(screen.getByRole('link', { name: /Event EVOS/ })).toHaveAttribute('href', '/kalender');
  });
  it('no ponds: explains what to do', async () => {
    mockApi({ ponds: [] });
    renderApp('/');
    expect(await screen.findByText(/Belum ada settling pond aktif/)).toBeInTheDocument();
  });
  it('a failed day load shows the error', async () => {
    mockApi({ handler: (u) => (u.startsWith('/api/day') ? json({ error: 'Terjadi kesalahan. Coba lagi.' }, 500) : undefined) });
    renderApp('/');
    expect(await screen.findByText('Terjadi kesalahan. Coba lagi.')).toBeInTheDocument();
  });
});

describe('BerandaOperator when the pond list fails to load', () => {
  it('names the failure and offers a retry instead of saying there are no ponds', async () => {
    mockApi({ role: 'Operator', handler: pondsFailOnce() });
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan. Coba lagi.');
    expect(screen.queryByText(/Belum ada settling pond aktif/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('combobox', { name: /Settling Pond/ })).toBeInTheDocument();
  });
});

describe('Beranda Operator events', () => {
  const summary = (overdue: number) => (u: string) => (u.startsWith('/api/events/summary') ? json({ today: '2026-11-02', overdue, due_today: 1 }) : undefined);
  it('shows the overdue count on the tile and a banner to the calendar', async () => {
    mockApi({ handler: summary(2) });
    renderApp('/');
    const banner = await screen.findByRole('link', { name: '2 event overdue' });
    expect(banner).toHaveAttribute('href', '/kalender');
    expect(screen.getAllByText('2 event overdue').length).toBeGreaterThanOrEqual(1);
  });
  it('says nothing is late and shows no banner when there is no overdue', async () => {
    mockApi({ handler: summary(0) });
    renderApp('/');
    expect(await screen.findByText('Tidak ada yang telat')).toBeInTheDocument();
    expect(screen.queryByText(/Unggah eviden untuk menyelesaikannya/)).toBeNull();
  });
  it('a failing summary does not break the page', async () => {
    mockApi({ handler: (u) => (u.startsWith('/api/events/summary') ? json({ error: 'x' }, 500) : undefined) });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Halo, Rudi' })).toBeInTheDocument();
    expect(screen.queryByText(/event overdue/)).toBeNull();
  });
});
