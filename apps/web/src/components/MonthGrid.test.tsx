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
  it('shows one dot per kind of event that day and says so in words', () => {
    render(<MonthGrid {...base} marks={{ '2026-11-03': ['overdue', 'pending', 'done'], '2026-11-05': ['pending'], '2026-11-06': ['done'] }} />);
    const three = screen.getByRole('button', { name: '3 November, ada overdue, menunggu, selesai' });
    expect(three).toHaveAttribute('data-marks', 'overdue pending done');
    expect(three.querySelectorAll('.ui-dot')).toHaveLength(3);
    expect(three.querySelector('.ui-dot.is-overdue')).not.toBeNull();
    expect(three.querySelector('.ui-dot.is-pending')).not.toBeNull();
    expect(three.querySelector('.ui-dot.is-done')).not.toBeNull();
    expect(screen.getByRole('button', { name: '5 November, menunggu' })).toHaveAttribute('data-marks', 'pending');
    expect(screen.getByRole('button', { name: '6 November, selesai' })).toHaveAttribute('data-marks', 'done');
  });
  it('a day with nothing has no dot and no mark', () => {
    render(<MonthGrid {...base} marks={{}} />);
    const b = screen.getByRole('button', { name: '9 November' });
    expect(b).not.toHaveAttribute('data-marks');
    expect(b.querySelectorAll('.ui-dot')).toHaveLength(0);
  });
  it('explains the three colours in words, so colour is not the only signal', () => {
    render(<MonthGrid {...base} />);
    const legend = screen.getByRole('list', { name: 'Arti titik' });
    expect(within(legend).getByText('Overdue')).toBeInTheDocument();
    expect(within(legend).getByText('Menunggu')).toBeInTheDocument();
    expect(within(legend).getByText('Selesai')).toBeInTheDocument();
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
  it('read-only overview: no day buttons or arrows, but the marks are still said in words', () => {
    render(<MonthGrid month="2026-11" today="2026-11-02" marks={{ '2026-11-03': ['overdue', 'done'] }} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    const cell = screen.getByTestId('day-2026-11-03');
    expect(within(cell).getByText(/ada overdue, selesai/)).toBeInTheDocument();
    expect(cell).toHaveAttribute('data-marks', 'overdue done');
    expect(cell.querySelectorAll('.ui-dot')).toHaveLength(2);
  });
});
