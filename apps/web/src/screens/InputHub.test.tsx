import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { json, mockApi, renderApp, emptyDay } from '../test-utils';

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
