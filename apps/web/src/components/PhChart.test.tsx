import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhChart } from './PhChart';

const day = (d: number, i: number | null, o: number | null) => ({ date: `2026-11-0${d}`, ph_inlet: i, ph_outlet: o });
const week = [day(1, 6.1, 7.2), day(2, 6.0, 7.0), day(3, 5.9, 6.9), day(4, 6.2, 7.1), day(5, 5.8, 6.8), day(6, 5.6, 6.4), day(7, 5.5, 5.6)];

describe('PhChart', () => {
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
