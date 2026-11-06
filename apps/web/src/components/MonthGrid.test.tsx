import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonthGrid } from './MonthGrid';

const base = { month: '2026-11', selected: '2026-11-04', today: '2026-11-02', marks: {}, onSelect: () => {}, onPrev: () => {}, onNext: () => {} };

describe('MonthGrid', () => {
  it('shows the month and a day button for each day of it', () => {
    render(<MonthGrid {...base} />);
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^\d+ November/ })).toHaveLength(30);
  });
  it('starts the week on Monday: 1 Nov 2026 is a Sunday, so it sits in the 7th column', () => {
    render(<MonthGrid {...base} />);
    expect(screen.getByRole('button', { name: /^1 November/ })).toHaveStyle({ gridColumnStart: '7' });
    expect(screen.getByRole('button', { name: /^2 November/ })).toHaveStyle({ gridColumnStart: '1' });
  });
  it('lists Monday to Sunday as headers', () => {
    render(<MonthGrid {...base} />);
    expect(screen.getAllByTestId('weekday').map((w) => w.textContent)).toEqual(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']);
  });
  it('counts the right number of days in other months, including a leap February', () => {
    const { rerender } = render(<MonthGrid {...base} month="2028-02" selected="2028-02-10" today="2028-02-10" />);
    expect(screen.getAllByRole('button', { name: /^\d+ Februari/ })).toHaveLength(29);
    rerender(<MonthGrid {...base} month="2027-02" selected="2027-02-10" today="2027-02-10" />);
    expect(screen.getAllByRole('button', { name: /^\d+ Februari/ })).toHaveLength(28);
    rerender(<MonthGrid {...base} month="2026-12" selected="2026-12-10" today="2026-12-10" />);
    expect(screen.getAllByRole('button', { name: /^\d+ Desember/ })).toHaveLength(31);
  });
  it('marks today and the selected day', () => {
    render(<MonthGrid {...base} />);
    expect(screen.getByRole('button', { name: /^2 November/ })).toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('button', { name: /^4 November/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^5 November/ })).toHaveAttribute('aria-pressed', 'false');
  });
  const M = (key: string, name: string, color: string) => ({ key, name, color });
  const AIR = M('k1', 'Air', '#2E7D32'), UDARA = M('k2', 'Udara', '#1565C0'), NONE = M('none', 'Tanpa kategori', '#9AA39A');
  const dotsOf = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>('.ui-ring .ui-dot'));
  it('shows one dot per category around the date, starting at the top, and names them in words', () => {
    render(<MonthGrid {...base} marks={{ '2026-11-03': [AIR, UDARA, NONE], '2026-11-05': [AIR] }} />);
    const three = screen.getByRole('button', { name: '3 November, Air, Udara, Tanpa kategori' });
    expect(three).toHaveAttribute('data-marks', 'k1 k2 none');
    const dots = dotsOf(three);
    expect(dots.map((d) => d.style.getPropertyValue('--bg'))).toEqual(['#2E7D32', '#1565C0', '#9AA39A']);
    expect(dots.map((d) => d.style.getPropertyValue('--a'))).toEqual(['-90deg', '30deg', '150deg']);
    const one = screen.getByRole('button', { name: '5 November, Air' });
    expect(dotsOf(one).map((d) => d.style.getPropertyValue('--a'))).toEqual(['-90deg']);
  });
  it('more than eight categories: seven dots and one "more" dot, but every name is still said', () => {
    const many = Array.from({ length: 9 }, (_, i) => M(`k${i}`, `Kat ${i}`, '#2E7D32'));
    render(<MonthGrid {...base} marks={{ '2026-11-03': many }} />);
    const day = screen.getByRole('button', { name: new RegExp(`^3 November, ${many.map((m) => m.name).join(', ')}$`) });
    expect(dotsOf(day)).toHaveLength(8);
    expect(day.querySelectorAll('.ui-dot.is-more')).toHaveLength(1);
    expect(dotsOf(day)[7]).toHaveClass('is-more');
  });
  it('a day with nothing has no ring and no mark', () => {
    render(<MonthGrid {...base} marks={{}} />);
    const b = screen.getByRole('button', { name: '9 November' });
    expect(b).not.toHaveAttribute('data-marks');
    expect(b.querySelector('.ui-ring')).toBeNull();
  });
  it('the legend lists the categories of this month, in order, and no status words', () => {
    render(<MonthGrid {...base} marks={{ '2026-11-03': [UDARA, NONE], '2026-11-04': [AIR], '2026-10-30': [M('k9', 'Bulan lalu', '#C62828')] }} />);
    const legend = screen.getByRole('list', { name: 'Kategori' });
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Air', 'Udara', 'Tanpa kategori']);
    expect(screen.queryByText('Overdue')).toBeNull();
    expect(screen.queryByText('Menunggu')).toBeNull();
  });
  it('reports the chosen day and the month arrows', async () => {
    const sel = vi.fn(); const prev = vi.fn(); const next = vi.fn();
    render(<MonthGrid {...base} onSelect={sel} onPrev={prev} onNext={next} />);
    await userEvent.click(screen.getByRole('button', { name: /^17 November/ }));
    expect(sel).toHaveBeenCalledWith('2026-11-17');
    await userEvent.click(screen.getByRole('button', { name: 'Bulan sebelumnya' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bulan berikutnya' }));
    expect(prev).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
  it('read-only overview: no day buttons or arrows, but the categories are still said in words', () => {
    render(<MonthGrid month="2026-11" today="2026-11-02" marks={{ '2026-11-03': [AIR, UDARA] }} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    const cell = screen.getByTestId('day-2026-11-03');
    expect(within(cell).getByText(/Air, Udara/)).toBeInTheDocument();
    expect(cell).toHaveAttribute('data-marks', 'k1 k2');
    expect(dotsOf(cell)).toHaveLength(2);
  });
});
