import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { pondsFailOnce, json, mockApi, renderApp, emptyDay } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

describe('Input hub', () => {
  it('lists the three modules with today status', async () => {
    mockApi({
      handler: (u) => (u.startsWith('/api/day')
        ? json({ ...emptyDay, weather: { rainfall_mm: 1, rain_hours: 1 }, coagulant: { ...emptyDay.coagulant, Kapur: { stock_in: 1, stock_out: 0, stock_remaining: 1 } } })
        : undefined),
    });
    renderApp('/input');
    await screen.findByText('1 dari 3 jenis');
    const cuaca = screen.getByRole('link', { name: /Cuaca/ });
    expect(cuaca).toHaveTextContent('Sudah diisi');
    expect(screen.getByRole('link', { name: /Air Permukaan/ })).toHaveTextContent('Belum diisi');
    expect(screen.getByRole('link', { name: /Koagulan/ })).toHaveTextContent('1 dari 3 jenis');
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
