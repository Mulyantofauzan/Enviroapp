import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PeriodSummary } from './PeriodSummary';
import type { PeriodSummary as S } from '@evo/shared';

const s = (o: Partial<S> = {}): S => ({
  ph: { checked: 7, violations: 1, compliant_pct: 86 }, tss: { checked: 7, violations: 3, compliant_pct: 57 },
  noflow_days: 2, rain_total_mm: 41.5, coag_out_kg: 120, avg_ph_outlet: 7.2, avg_tss_outlet: 35, ...o,
});

describe('PeriodSummary', () => {
  it('shows compliance, violation days, no-flow days, rain and coagulant totals for the period', () => {
    render(<PeriodSummary days={30} current={s()} previous={s()} />);
    const ph = screen.getByRole('group', { name: 'Patuh pH' });
    expect(within(ph).getByText('86%')).toBeInTheDocument();
    expect(within(ph).getByText('1 dari 7 hari melanggar')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Patuh TSS' })).getByText('57%')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Hari no flow' })).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Total hujan' })).getByText('41,5')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Koagulan keluar' })).getByText('120')).toBeInTheDocument();
  });
  it('compares with the previous period of the same length', () => {
    render(<PeriodSummary days={7} current={s()} previous={s({ ph: { checked: 7, violations: 3, compliant_pct: 57 }, noflow_days: 0, rain_total_mm: 50 })} />);
    expect(within(screen.getByRole('group', { name: 'Patuh pH' })).getByText('Naik 29 poin dari 7 hari sebelumnya')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Total hujan' })).getByText('7 hari sebelumnya: 50')).toBeInTheDocument();
  });
  it('says there is no data instead of a percentage or a made-up comparison', () => {
    const none = s({ ph: { checked: 0, violations: 0, compliant_pct: null }, rain_total_mm: null, coag_out_kg: null });
    render(<PeriodSummary days={7} current={none} previous={none} />);
    const ph = screen.getByRole('group', { name: 'Patuh pH' });
    expect(within(ph).getByText('Belum ada data')).toBeInTheDocument();
    expect(within(ph).queryByText(/sebelumnya/)).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Total hujan' })).getByText('Belum ada data')).toBeInTheDocument();
  });
  it('says Sama when nothing changed', () => {
    render(<PeriodSummary days={7} current={s()} previous={s()} />);
    expect(within(screen.getByRole('group', { name: 'Patuh pH' })).getByText('Sama seperti 7 hari sebelumnya')).toBeInTheDocument();
  });
});
