import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RainChart } from './RainChart';

const s = (vals: (number | null)[]) => vals.map((value, i) => ({ date: `2026-11-0${i + 1}`, value }));

describe('RainChart', () => {
  it('draws one bar per day that has rainfall, none for missing days', () => {
    const { container } = render(<RainChart series={s([0, 12.5, null, 4, null])} />);
    expect(container.querySelectorAll('rect[data-bar]')).toHaveLength(3); // 0, 12.5, 4
  });
  it('the tallest bar belongs to the largest value and bars scale with value', () => {
    const { container } = render(<RainChart series={s([5, 10, 2.5])} />);
    const h = [...container.querySelectorAll('rect[data-bar]')].map((r) => Number(r.getAttribute('height')));
    expect(h[1]).toBeGreaterThan(h[0]);
    expect(h[0]).toBeGreaterThan(h[2]);
    expect(h[1] / h[0]).toBeCloseTo(2, 1);
  });
  it('a zero-rain day has no visible height rather than a fake bar', () => {
    const { container } = render(<RainChart series={s([0, 8])} />);
    const h = [...container.querySelectorAll('rect[data-bar]')].map((r) => Number(r.getAttribute('height')));
    expect(h[0]).toBe(0);
  });
  it('names itself with the total, in Indonesian number format', () => {
    render(<RainChart series={s([12.5, 4, null])} />);
    expect(screen.getByRole('img', { name: 'Grafik curah hujan, 3 hari. Total 16,5 mm.' })).toBeInTheDocument();
  });
  it('ships a data table', () => {
    render(<RainChart series={s([1, 2, 3])} />);
    expect(screen.getByRole('columnheader', { name: 'Curah hujan (mm)' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });
  it('renders nothing when there is no rainfall record at all', () => {
    const { container } = render(<RainChart series={s([null, null])} />);
    expect(container).toBeEmptyDOMElement();
  });
});
