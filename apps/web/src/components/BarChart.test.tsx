import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChart } from './BarChart';

const cats = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `L${i}`, partial: i === n - 1 }));
const labels = (c: HTMLElement) => [...c.querySelectorAll('text.ui-chart__label')].map((t) => t.textContent);

describe('BarChart', () => {
  it('single series: one bar and one label per category, id-ID format', () => {
    const { container } = render(<BarChart name="Curah hujan" unit="mm/hari" categories={cats(5)} series={[{ name: 'Rata-rata', values: [1.5, 2, 0, 4.25, 3] }]} />);
    expect(container.querySelectorAll('rect[data-bar]')).toHaveLength(5);
    expect(labels(container)).toEqual(['1,5', '2', '0', '4,3', '3']);
  });
  it('null is a gap: no bar and no label', () => {
    const { container } = render(<BarChart name="Tawas" unit="kg" categories={cats(3)} series={[{ name: 'Tawas', values: [10, null, 5] }]} />);
    expect(container.querySelectorAll('rect[data-bar]')).toHaveLength(2);
    expect(labels(container)).toEqual(['10', '5']);
  });
  it('all null shows the empty message and no svg', () => {
    const { container } = render(<BarChart name="Tawas" unit="kg" categories={cats(3)} series={[{ name: 'Tawas', values: [null, null, null] }]} />);
    expect(screen.getByText('Belum ada data pada rentang ini.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });
  it('bar height is proportional', () => {
    const { container } = render(<BarChart name="x" unit="kg" categories={cats(2)} series={[{ name: 'x', values: [10, 20] }]} />);
    const h = [...container.querySelectorAll('rect[data-bar]')].map((r) => Number(r.getAttribute('height')));
    expect(h[1] / h[0]).toBeCloseTo(2, 1);
  });
  it('a real zero is labelled "0" with no height', () => {
    const { container } = render(<BarChart name="x" unit="kg" categories={cats(2)} series={[{ name: 'x', values: [0, 5] }]} />);
    expect(labels(container)[0]).toBe('0');
    expect(Number(container.querySelectorAll('rect[data-bar]')[0].getAttribute('height'))).toBe(0);
  });
  it('grouped bars with 21 bars label only four per series', () => {
    const vals = (base: number) => Array.from({ length: 7 }, (_, i) => base + i);
    const { container } = render(<BarChart name="Penggunaan" unit="kg" categories={cats(7)} series={[
      { name: 'Kapur', values: vals(1) }, { name: 'Tawas Serbuk', values: vals(10) }, { name: 'Tawas Batu', values: vals(20) },
    ]} />);
    expect(container.querySelectorAll('rect[data-bar]')).toHaveLength(21);
    expect(labels(container).length).toBeLessThanOrEqual(12);
    expect(labels(container).length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll('rect.ui-chart__bar--2').length).toBe(7);
  });
  it('names itself with unit, highest and last value; partial categories are marked in the data table', () => {
    render(<BarChart name="Penggunaan tawas" unit="kg" categories={cats(3)} series={[{ name: 'Tawas', values: [10, 30, 20] }]} />);
    expect(screen.getByRole('img', { name: /Penggunaan tawas.*kg.*tertinggi 30.*terakhir 20/ })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'L2 (berjalan)' })).toBeInTheDocument();
  });
  it('legend lists each series', () => {
    render(<BarChart name="x" unit="kg" categories={cats(2)} series={[{ name: 'Kapur', values: [1, 2] }, { name: 'Tawas Batu', values: [3, 4] }]} />);
    expect(screen.getByText('Kapur', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText('Tawas Batu', { selector: 'li' })).toBeInTheDocument();
  });
  it('twelve categories never print the last two labels on top of each other', () => {
    const { container } = render(<BarChart name="x" unit="kg" categories={cats(12)} series={[{ name: 'x', values: Array.from({ length: 12 }, (_, i) => i + 1) }]} />);
    const ticks = [...container.querySelectorAll('text.ui-chart__tick')].map((t) => t.textContent);
    expect(ticks).toContain('L11');
    expect(ticks).not.toContain('L10');
  });
});
