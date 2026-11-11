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

  describe('data labels', () => {
    const lab = (c: HTMLElement) => [...c.querySelectorAll('text.ui-chart__label')];
    it('labels every outlet and inlet point when there are few, in id-ID format', () => {
      const { container } = render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={undefined} floorZero decimals={1} />);
      expect(lab(container)).toHaveLength(10);
      expect(lab(container).map((t) => t.textContent)).toContain('38');
    });
    it('beyond 14 points per line only four are labelled', () => {
      const long = Array.from({ length: 20 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, inlet: null, outlet: 10 + (i % 5) }));
      const { container } = render(<TrendChart name="pH" unit="" series={long} limit={undefined} />);
      expect(lab(container).length).toBeLessThanOrEqual(4);
      expect(lab(container).length).toBeGreaterThanOrEqual(2);
    });
    it('outlet labels sit above the point and inlet labels below it', () => {
      const { container } = render(<TrendChart name="TSS" unit="mg/L" series={[d(1, 20, 40), d(2, 22, 42)]} limit={undefined} />);
      const out = container.querySelector('circle.ui-chart__dot')!;
      const outLabel = lab(container).find((t) => t.textContent === '40')!;
      expect(Number(outLabel.getAttribute('y'))).toBeLessThan(Number(out.getAttribute('cy')));
      const inLabel = lab(container).find((t) => t.textContent === '20')!;
      const outAtSameDay = lab(container).find((t) => t.textContent === '40')!;
      expect(Number(inLabel.getAttribute('y'))).toBeGreaterThan(Number(outAtSameDay.getAttribute('y')));
    });
    it('abnormal outlet labels are marked', () => {
      const { container } = render(<TrendChart name="TSS" unit="mg/L" series={tss} limit={{ min: null, max: 40 }} floorZero />);
      expect(container.querySelectorAll('text.ui-chart__label--bad')).toHaveLength(2);
    });
    it('hide="inlet" drops the inlet line, label, legend entry and table column', () => {
      const { container } = render(<TrendChart name="Curah hujan" unit="mm" series={tss} limit={undefined} hide="inlet" outletLabel="Curah hujan" />);
      expect(container.querySelector('[data-line="inlet"]')).toBeNull();
      expect(lab(container)).toHaveLength(5);
      expect(screen.queryByText('Inlet')).toBeNull();
      expect(screen.getByText('Curah hujan', { selector: 'li' })).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /inlet/i })).toBeNull();
    });
  });

  describe('wide axis labels', () => {
    it('makes room on the left for five-digit values so tick labels are not cut off', () => {
      const big = [d(1, null, 38102.4), d(2, null, 43200)];
      const { container } = render(<TrendChart name="Debit outlet" unit="m³/d" series={big} limit={undefined} hide="inlet" floorZero />);
      const x1 = Number(container.querySelector('line.ui-chart__grid')!.getAttribute('x1'));
      const longest = Math.max(...[...container.querySelectorAll('text.ui-chart__tick')].filter((t) => t.getAttribute('text-anchor') === 'end').map((t) => (t.textContent ?? '').length));
      expect(x1).toBeGreaterThanOrEqual(longest * 6 + 6);
    });
    it('small values keep the compact margin', () => {
      const { container } = render(<TrendChart name="pH" unit="" series={[d(1, 6, 7), d(2, 6, 8)]} limit={undefined} />);
      expect(Number(container.querySelector('line.ui-chart__grid')!.getAttribute('x1'))).toBe(38);
    });
  });
});

describe('TrendChart: no-flow days', () => {
  const series = [d(1, 7, 7.5), { ...d(2, 7, 0), noFlow: true }, d(3, 7, 7.2)];
  it('draws a no-flow day as a marker on the baseline, never as abnormal', () => {
    const { container } = render(<TrendChart name="pH" series={series} limit={{ min: 6, max: 9 }} />);
    expect(container.querySelectorAll('[data-noflow]')).toHaveLength(1);
    expect(container.querySelector('[data-abnormal]')).toBeNull();
    expect(container.querySelector('text.ui-chart__label--bad')).toBeNull();
  });
  it('says No flow in the screen-reader table', () => {
    render(<TrendChart name="pH" series={series} limit={undefined} />);
    expect(screen.getByRole('cell', { name: 'No flow' })).toBeInTheDocument();
  });
  it('keeps no-flow days out of the scale and breaks the line there', () => {
    const { container } = render(<TrendChart name="pH" series={series} limit={{ min: 6, max: 9 }} floorZero />);
    expect(container.querySelectorAll('path[data-line="outlet"]')).toHaveLength(0);
    const ticks = [...container.querySelectorAll('text.ui-chart__tick')].filter((t) => t.getAttribute('text-anchor') === 'end').map((t) => Number((t.textContent ?? '').replace(',', '.')));
    expect(Math.min(...ticks)).toBeGreaterThan(0);
    const cy = Number(container.querySelector('[data-noflow]')!.getAttribute('cy'));
    const grid = [...container.querySelectorAll('line.ui-chart__grid')].map((l) => Number(l.getAttribute('y1')));
    expect(cy).toBeGreaterThanOrEqual(Math.max(...grid));
  });
  it('does not repeat an inlet label that equals the outlet label', () => {
    const same = [d(1, 7, 7), d(2, 7, 7)];
    const { container } = render(<TrendChart name="pH" series={same} limit={undefined} />);
    expect(container.querySelectorAll('text.ui-chart__label')).toHaveLength(2);
  });
});
