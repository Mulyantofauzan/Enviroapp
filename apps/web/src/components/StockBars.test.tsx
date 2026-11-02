import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockBars } from './StockBars';

const items = [
  { type: 'Kapur', remaining: 260, max: 260, updated: '2026-11-02' },
  { type: 'Tawas Serbuk', remaining: 87.5, max: 260, updated: '2026-11-02' },
  { type: 'Tawas Batu', remaining: null, max: null, updated: null },
];

describe('StockBars', () => {
  it('bar is remaining over the highest value in the range', () => {
    render(<StockBars items={items} />);
    expect(screen.getByRole('meter', { name: 'Kapur' })).toHaveStyle({ width: '100%' });
    const w = parseFloat((screen.getByRole('meter', { name: 'Tawas Serbuk' }) as HTMLElement).style.width);
    expect(Math.round(w)).toBe(34);
  });
  it('shows numbers in id-ID', () => {
    render(<StockBars items={items} />);
    expect(screen.getByText('260')).toBeInTheDocument();
    expect(screen.getByText('87,5')).toBeInTheDocument();
  });
  it('a type with no records says so instead of an empty bar', () => {
    render(<StockBars items={items} />);
    expect(screen.getByText('Belum ada data')).toBeInTheDocument();
    expect(screen.queryByRole('meter', { name: 'Tawas Batu' })).toBeNull();
  });
  it('explains the scale', () => {
    render(<StockBars items={items} />);
    expect(screen.getByText('Batang: dibanding sisa tertinggi dalam rentang')).toBeInTheDocument();
  });
  it('negative stock gets an empty bar, not a negative width', () => {
    render(<StockBars items={[{ type: 'Kapur', remaining: -5, max: 100, updated: '2026-11-02' }]} />);
    expect(screen.getByRole('meter', { name: 'Kapur' })).toHaveStyle({ width: '0%' });
  });
});
