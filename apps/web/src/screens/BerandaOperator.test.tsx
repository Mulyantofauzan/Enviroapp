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
    expect(within(card).getByText('1.278,7')).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: /Air Permukaan/ })).toHaveAttribute('href', '/input/air');
    expect(screen.getByRole('link', { name: /Koagulan/ })).toHaveAttribute('href', '/input/koagulan');
    expect(screen.queryByText(/Event Enviro/)).toBeNull();
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
