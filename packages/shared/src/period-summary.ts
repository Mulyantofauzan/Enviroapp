import { isNoFlow } from './math';
import { isOutOfLimit } from './thresholds';
import type { Threshold } from './types';

export type PeriodDay = {
  ph_outlet: number | null; tss_outlet: number | null; debit_outlet_m3s: number | null;
  rainfall_mm: number | null; coag_out_kg: number | null;
};
export type Compliance = { checked: number; violations: number; compliant_pct: number | null };
export type PeriodSummary = {
  ph: Compliance; tss: Compliance; noflow_days: number;
  rain_total_mm: number | null; coag_out_kg: number | null;
  avg_ph_outlet: number | null; avg_tss_outlet: number | null;
};

const hasLimit = (t: Threshold | undefined) => !!t && (t.min !== null || t.max !== null);
const round1 = (n: number) => Math.round(n * 10) / 10;

function compliance(values: (number | null)[], t: Threshold | undefined): Compliance {
  if (!hasLimit(t)) return { checked: 0, violations: 0, compliant_pct: null };
  const present = values.filter((v): v is number => v !== null);
  const violations = present.filter((v) => isOutOfLimit(v, t)).length;
  return { checked: present.length, violations, compliant_pct: present.length ? Math.round(((present.length - violations) / present.length) * 100) : null };
}
const total = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? round1(v.reduce((a, b) => a + b, 0)) : null;
};
const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/** No-flow days (outlet debit exactly 0) are neither a violation nor compliance, and stay out of the averages. */
export function summarizePeriod(days: PeriodDay[], th: Record<string, Threshold>): PeriodSummary {
  const flowing = days.filter((d) => !isNoFlow(d.debit_outlet_m3s));
  return {
    ph: compliance(flowing.map((d) => d.ph_outlet), th.ph_outlet),
    tss: compliance(flowing.map((d) => d.tss_outlet), th.tss_outlet),
    noflow_days: days.length - flowing.length,
    rain_total_mm: total(days.map((d) => d.rainfall_mm)),
    coag_out_kg: total(days.map((d) => d.coag_out_kg)),
    avg_ph_outlet: mean(flowing.map((d) => d.ph_outlet)),
    avg_tss_outlet: mean(flowing.map((d) => d.tss_outlet)),
  };
}
