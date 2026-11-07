import { describe, it, expect } from 'vitest';
import { summarizePeriod, type PeriodDay } from './period-summary';

const day = (o: Partial<PeriodDay> = {}): PeriodDay => ({ ph_outlet: null, tss_outlet: null, debit_outlet_m3s: null, rainfall_mm: null, coag_out_kg: null, ...o });
const th = { ph_outlet: { min: 6, max: 9 }, tss_outlet: { min: null, max: 50 } };

describe('summarizePeriod', () => {
  it('counts violations and compliance per parameter', () => {
    const s = summarizePeriod([day({ ph_outlet: 7, tss_outlet: 40 }), day({ ph_outlet: 5.5, tss_outlet: 60 }), day({ ph_outlet: 8, tss_outlet: 55 }), day({ ph_outlet: 7, tss_outlet: 10 })], th);
    expect(s.ph).toEqual({ checked: 4, violations: 1, compliant_pct: 75 });
    expect(s.tss).toEqual({ checked: 4, violations: 2, compliant_pct: 50 });
  });
  it('skips days without a value and never counts them as compliant', () => {
    const s = summarizePeriod([day(), day({ ph_outlet: 7 }), day()], th);
    expect(s.ph).toEqual({ checked: 1, violations: 0, compliant_pct: 100 });
    expect(s.tss).toEqual({ checked: 0, violations: 0, compliant_pct: null });
  });
  it('excludes no-flow days from compliance and counts them', () => {
    const s = summarizePeriod([day({ ph_outlet: 0, tss_outlet: 0, debit_outlet_m3s: 0 }), day({ ph_outlet: 7, tss_outlet: 10, debit_outlet_m3s: 0.01 })], th);
    expect(s.noflow_days).toBe(1);
    expect(s.ph).toEqual({ checked: 1, violations: 0, compliant_pct: 100 });
    expect(s.tss.checked).toBe(1);
  });
  it('ignores thresholds that are not set', () => {
    const s = summarizePeriod([day({ ph_outlet: 2 })], {});
    expect(s.ph).toEqual({ checked: 0, violations: 0, compliant_pct: null });
  });
  it('totals rain and coagulant, null when nothing was recorded', () => {
    const s = summarizePeriod([day({ rainfall_mm: 4.5, coag_out_kg: 10 }), day({ rainfall_mm: 0, coag_out_kg: 2.5 }), day()], th);
    expect(s.rain_total_mm).toBe(4.5);
    expect(s.coag_out_kg).toBe(12.5);
    const e = summarizePeriod([day(), day()], th);
    expect(e.rain_total_mm).toBeNull();
    expect(e.coag_out_kg).toBeNull();
  });
  it('averages outlet pH and TSS over flowing days only', () => {
    const s = summarizePeriod([day({ ph_outlet: 7, tss_outlet: 20 }), day({ ph_outlet: 8, tss_outlet: 40 }), day({ ph_outlet: 0, tss_outlet: 0, debit_outlet_m3s: 0 })], th);
    expect(s.avg_ph_outlet).toBe(7.5);
    expect(s.avg_tss_outlet).toBe(30);
    expect(summarizePeriod([], th).avg_tss_outlet).toBeNull();
  });
});
