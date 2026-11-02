import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendChart } from './TrendChart';

const d = (n: number, inlet: number | null, outlet: number | null) => ({ date: `2026-11-0${n}`, inlet, outlet });
const tss = [d(1, 120, 30), d(2, 180, 38), d(3, 250, 55), d(4, 90, 20), d(5, 110, 41)];

describe('TrendChart (TSS)', () => {
  it('names itself for what it shows and gives the last outlet value', () => {
    render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={{ min: null, max: 40 }} floorZero />);
    expect(screen.getByRole('img', { name: /Grafik TSS inlet dan outlet, 5 hari. Nilai outlet terakhir 41/ })).toBeInTheDocument();
  });
  it('a maximum-only limit draws a band and marks outlet values above it', () => {
    const { container } = render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={{ min: null, max: 40 }} floorZero />);
    expect(container.querySelector('[data-band]')).not.toBeNull();
    expect(container.querySelectorAll('circle[data-abnormal]')).toHaveLength(2); // 55 and 41
  });
  it('legend says what the band is', () => {
    render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={{ min: null, max: 40 }} floorZero />);
    expect(screen.getByText('Baku mutu (maks. 40)')).toBeInTheDocument();
  });
  it('keeps the axis readable for large values: few ticks, none negative', () => {
    const { container } = render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={{ min: null, max: 40 }} floorZero />);
    const ticks = [...container.querySelectorAll('text.ui-chart__tick')].map((t) => t.textContent ?? '');
    const yTicks = container.querySelectorAll('line.ui-chart__grid');
    expect(yTicks.length).toBeLessThanOrEqual(7);
    expect(yTicks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.some((t) => t.startsWith('-'))).toBe(false);
  });
  it('without a limit there is no band and no abnormal mark', () => {
    const { container } = render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={undefined} floorZero />);
    expect(container.querySelector('[data-band]')).toBeNull();
    expect(container.querySelectorAll('circle[data-abnormal]')).toHaveLength(0);
  });
  it('a missing day breaks the line instead of drawing zero', () => {
    const gap = [tss[0], tss[1], d(3, null, null), tss[3], tss[4]];
    const { container } = render(<TrendChart name="TSS" unit="mg/L" series={gap} limit={undefined} floorZero />);
    expect(container.querySelectorAll('path[data-line="outlet"]')).toHaveLength(2);
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
});
