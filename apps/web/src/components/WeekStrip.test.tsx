import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekStrip } from './WeekStrip';

const base = { weekStart: '2026-11-02', selected: '2026-11-02', today: '2026-11-02', marks: {}, onSelect: () => {}, onPrev: () => {}, onNext: () => {} };

describe('WeekStrip', () => {
  it('shows Monday to Sunday', () => {
    render(<WeekStrip {...base} />);
    for (const [n, d] of [['Sen', 2], ['Sel', 3], ['Rab', 4], ['Kam', 5], ['Jum', 6], ['Sab', 7], ['Min', 8]] as const)
      expect(screen.getByRole('button', { name: new RegExp(`^${n} ${d}`) })).toBeInTheDocument();
  });
  it('marks today and the selected day', () => {
    render(<WeekStrip {...base} selected="2026-11-04" />);
    expect(screen.getByRole('button', { name: /^Sen 2/ })).toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('button', { name: /^Rab 4/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Sel 3/ })).toHaveAttribute('aria-pressed', 'false');
  });
  it('red for overdue, blue for scheduled, none otherwise, and the label says so', () => {
    render(<WeekStrip {...base} marks={{ '2026-11-02': 'overdue', '2026-11-04': 'scheduled' }} />);
    expect(screen.getByRole('button', { name: 'Sen 2, ada overdue' })).toHaveAttribute('data-mark', 'overdue');
    expect(screen.getByRole('button', { name: 'Rab 4, terjadwal' })).toHaveAttribute('data-mark', 'scheduled');
    expect(screen.getByRole('button', { name: 'Sel 3' })).not.toHaveAttribute('data-mark');
  });
  it('reports the chosen day', async () => {
    const f = vi.fn();
    render(<WeekStrip {...base} onSelect={f} />);
    await userEvent.click(screen.getByRole('button', { name: /^Kam 5/ }));
    expect(f).toHaveBeenCalledWith('2026-11-05');
  });
  it('week arrows call back', async () => {
    const prev = vi.fn(); const next = vi.fn();
    render(<WeekStrip {...base} onPrev={prev} onNext={next} />);
    await userEvent.click(screen.getByRole('button', { name: 'Minggu sebelumnya' }));
    await userEvent.click(screen.getByRole('button', { name: 'Minggu berikutnya' }));
    expect(prev).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
  it('titles the week', () => {
    render(<WeekStrip {...base} />);
    expect(screen.getByText('2 Nov s/d 8 Nov 2026')).toBeInTheDocument();
  });
});
