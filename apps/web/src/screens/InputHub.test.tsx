import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { pondsFailOnce, json, mockApi, renderApp, emptyDay } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

describe('Input hub', () => {
  it('lists the two modules with today status', async () => {
    mockApi({
      handler: (u) => (u.startsWith('/api/day')
        ? json({ ...emptyDay, weather: { rainfall_mm: 1, rain_hours: 1 }, coagulant: { ...emptyDay.coagulant, Kapur: { stock_in: 1, stock_out: 0, stock_remaining: 1 } } })
        : undefined),
    });
    renderApp('/input');
    await screen.findByText('Air belum, koagulan 1 dari 3');
    const cuaca = screen.getByRole('link', { name: /Cuaca/ });
    expect(cuaca).toHaveTextContent('Sudah diisi');
    expect(screen.getByRole('link', { name: /Air & Koagulan/ })).toHaveTextContent('Air belum, koagulan 1 dari 3');
  });
});

describe('Input hub: import link', () => {
  it('shows Impor Excel to Admin only', async () => {
    mockApi({ role: 'Admin' });
    renderApp('/input');
    expect(await screen.findByRole('link', { name: /Impor Excel/ })).toHaveAttribute('href', '/input/impor');
  });
  it('hides it from Operator', async () => {
    mockApi({ role: 'Operator' });
    renderApp('/input');
    await screen.findByRole('link', { name: /Cuaca/ });
    expect(screen.queryByRole('link', { name: /Impor Excel/ })).toBeNull();
  });
});

describe('InputHub when the pond list fails to load', () => {
  it('names the failure and offers a retry instead of saying there are no ponds', async () => {
    mockApi({ role: 'Operator', handler: pondsFailOnce() });
    renderApp('/input');
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan. Coba lagi.');
    expect(screen.queryByText(/Belum ada settling pond aktif/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('combobox', { name: /Settling Pond/ })).toBeInTheDocument();
  });
});
