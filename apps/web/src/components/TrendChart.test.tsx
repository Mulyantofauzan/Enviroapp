import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TrendChart } from './TrendChart';

const d = (n: number, inlet: number | null, outlet: number | null, noFlow?: boolean) => ({ date: `2026-11-0${n}`, inlet, outlet, noFlow });
const tss = [d(1, 120, 30), d(2, 180, 38), d(3, 250, 55), d(4, 90, 20), d(5, 110, 41)];

describe('TrendChart', () => {
  it('names itself for what it shows and gives the last outlet value', () => {
    render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={{ min: null, max: 40 }} floorZero />);
    expect(screen.getByRole('img', { name: /Grafik TSS inlet dan outlet, 5 hari. Nilai outlet terakhir 41/ })).toBeInTheDocument();
  });
  it('mounts an echarts svg inside the chart box', async () => {
    const { container } = render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={undefined} floorZero />);
    await waitFor(() => expect(container.querySelector('.ui-echart svg')).not.toBeNull());
  });
  it('legend says what the band is, and shows abnormal only with a band', () => {
    const { rerender } = render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={{ min: null, max: 40 }} floorZero />);
    expect(screen.getByText('Baku mutu (maks. 40)')).toBeInTheDocument();
    expect(screen.getByText('Abnormal')).toBeInTheDocument();
    rerender(<TrendChart name="TSS" unit="mg/L" series={tss} limit={undefined} floorZero />);
    expect(screen.queryByText('Abnormal')).toBeNull();
  });
  it('ships a data table for screen readers with the right headers', () => {
    render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={undefined} floorZero />);
    expect(screen.getByRole('columnheader', { name: 'TSS inlet' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(tss.length + 1);
  });
  it('renders nothing when there is no value at all', () => {
    const { container } = render(<TrendChart name="TSS" unit="mg/L" series={[d(1, null, null)]} limit={undefined} floorZero />);
    expect(container).toBeEmptyDOMElement();
  });
  it('hide="inlet" drops the inlet legend entry and table column', () => {
    render(<TrendChart name="Debit" series={tss} limit={undefined} hide="inlet" outletLabel="Debit outlet (L/s)" />);
    expect(screen.queryByText('Inlet')).toBeNull();
    expect(screen.getByText('Debit outlet (L/s)', { selector: 'li' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /inlet/i })).toBeNull();
  });
  it('a no-flow day shows in the legend and says No flow in the table, and is not the "last" value', () => {
    const series = [d(1, 7, 7.5), d(2, 7, 7.2), d(3, 7, 0, true)];
    render(<TrendChart name="pH" series={series} limit={{ min: 6, max: 9 }} />);
    expect(screen.getByText('No flow (tidak ada aliran)')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'No flow' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /terakhir 7,2/ })).toBeInTheDocument();
  });
});
