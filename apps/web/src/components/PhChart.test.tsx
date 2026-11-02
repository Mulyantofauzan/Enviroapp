import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhChart } from './PhChart';

const day = (d: number, i: number | null, o: number | null) => ({ date: `2026-11-0${d}`, ph_inlet: i, ph_outlet: o });
const week = [day(1, 6.1, 7.2), day(2, 6.0, 7.0), day(3, 5.9, 6.9), day(4, 6.2, 7.1), day(5, 5.8, 6.8), day(6, 5.6, 6.4), day(7, 5.5, 5.6)];

describe('PhChart', () => {
  it('draws one outlet line and one inlet line for a complete week', () => {
    const { container } = render(<PhChart series={week} band={{ min: 6, max: 9 }} />);
    expect(container.querySelectorAll('path[data-line="outlet"]')).toHaveLength(1);
    expect(container.querySelectorAll('path[data-line="inlet"]')).toHaveLength(1);
  });
  it('marks outlet values outside the band as abnormal', () => {
    const { container } = render(<PhChart series={week} band={{ min: 6, max: 9 }} />);
    expect(container.querySelectorAll('circle[data-abnormal]')).toHaveLength(1);
  });
  it('a missing day breaks the line instead of drawing zero', () => {
    const gap = [week[0], week[1], day(3, null, null), week[3], week[4]];
    const { container } = render(<PhChart series={gap} band={{ min: 6, max: 9 }} />);
    expect(container.querySelectorAll('path[data-line="outlet"]')).toHaveLength(2);
  });
  it('without a band there is no band and no abnormal mark', () => {
    const { container } = render(<PhChart series={week} band={undefined} />);
    expect(container.querySelector('[data-band]')).toBeNull();
    expect(container.querySelectorAll('circle[data-abnormal]')).toHaveLength(0);
  });
  it('draws the band when both limits exist', () => {
    const { container } = render(<PhChart series={week} band={{ min: 6, max: 9 }} />);
    expect(container.querySelector('[data-band]')).not.toBeNull();
  });
  it('names the last outlet value for assistive tech and ships a data table', () => {
    render(<PhChart series={week} band={{ min: 6, max: 9 }} />);
    expect(screen.getByRole('img', { name: /5,6/ })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(week.length + 1);
  });
  it('renders nothing when there is no pH at all', () => {
    const { container } = render(<PhChart series={[day(1, null, null), day(2, null, null)]} band={{ min: 6, max: 9 }} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('has a text legend', () => {
    render(<PhChart series={week} band={{ min: 6, max: 9 }} />);
    expect(screen.getByText('Outlet')).toBeInTheDocument();
    expect(screen.getByText('Inlet')).toBeInTheDocument();
    expect(screen.getByText('Baku mutu 6-9')).toBeInTheDocument();
    expect(screen.getByText('Abnormal')).toBeInTheDocument();
  });
});
