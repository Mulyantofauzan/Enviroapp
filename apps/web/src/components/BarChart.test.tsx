import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChart } from './BarChart';

const cats = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `L${i}`, partial: i === n - 1 }));

describe('BarChart', () => {
  it('all null shows the empty message and no chart', () => {
    const { container } = render(<BarChart name="Tawas" unit="kg" categories={cats(3)} series={[{ name: 'Tawas', values: [null, null, null] }]} />);
    expect(screen.getByText('Belum ada data pada rentang ini.')).toBeInTheDocument();
    expect(container.querySelector('.ui-echart')).toBeNull();
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
  it('a missing value is explained in the legend instead of drawn as zero', () => {
    render(<BarChart name="x" unit="mm" categories={cats(3)} series={[{ name: 'x', values: [1, 2, null] }]} />);
    expect(screen.getByText('belum ada data')).toBeInTheDocument();
  });
  it('a running period is explained in a footnote; no footnote when nothing is partial', () => {
    const { container, rerender } = render(<BarChart name="x" unit="kg" categories={cats(3)} series={[{ name: 'x', values: [10, 20, 5] }]} />);
    expect(container.querySelector('.ui-chart__foot')?.textContent).toBe('* periode berjalan');
    rerender(<BarChart name="x" unit="kg" categories={[{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]} series={[{ name: 'x', values: [1, 2] }]} />);
    expect(container.querySelector('.ui-chart__foot')).toBeNull();
  });
});
