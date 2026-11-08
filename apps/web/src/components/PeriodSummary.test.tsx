import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PeriodSummary } from './PeriodSummary';
import type { PeriodSummary as S } from '@evo/shared';

const s = (o: Partial<S> = {}): S => ({
  ph: { checked: 7, violations: 1, compliant_pct: 86 }, tss: { checked: 7, violations: 3, compliant_pct: 57 },
  noflow_days: 2, rain_total_mm: 41.5, coag_out_kg: 120, avg_ph_outlet: 7.2, avg_tss_outlet: 35, ...o,
});

describe('PeriodSummary', () => {
  it('shows no-flow days, rain and coagulant totals for the period, without compliance cards', () => {
    render(<PeriodSummary days={30} current={s()} previous={s()} />);
    expect(within(screen.getByRole('group', { name: 'Hari no flow' })).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Total hujan' })).getByText('41,5')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Koagulan keluar' })).getByText('120')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Patuh pH' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Patuh TSS' })).toBeNull();
  });
  it('compares with the previous period of the same length', () => {
    render(<PeriodSummary days={7} current={s()} previous={s({ noflow_days: 0, rain_total_mm: 50 })} />);
    expect(within(screen.getByRole('group', { name: 'Hari no flow' })).getByText('7 hari sebelumnya: 0')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Total hujan' })).getByText('7 hari sebelumnya: 50')).toBeInTheDocument();
  });
  it('says there is no data instead of a made-up number', () => {
    const none = s({ rain_total_mm: null, coag_out_kg: null });
    render(<PeriodSummary days={7} current={none} previous={none} />);
    expect(within(screen.getByRole('group', { name: 'Total hujan' })).getByText('Belum ada data')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Koagulan keluar' })).getByText('Belum ada data')).toBeInTheDocument();
  });
});
