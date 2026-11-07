import { formatNumber, type PeriodSummary as Summary } from '@evo/shared';

type Props = { days: number; current: Summary; previous: Summary };

function Stat({ label, value, unit, subs = [], bad }: { label: string; value: string | null; unit?: string; subs?: (string | undefined)[]; bad?: boolean }) {
  return (
    <div className="ui-card ui-stat" role="group" aria-label={label}>
      <span className="ui-stat__label">{label}</span>
      {value === null
        ? <strong className="is-empty">Belum ada data</strong>
        : <strong className={bad ? 'is-bad' : ''}>{value}{unit && <small> {unit}</small>}</strong>}
      {value !== null && subs.filter(Boolean).map((t) => <span key={t} className="ui-kpi__sub">{t}</span>)}
    </div>
  );
}

function pctChange(cur: number | null, prev: number | null, days: number) {
  if (cur === null || prev === null) return undefined;
  const d = cur - prev;
  if (d === 0) return `Sama seperti ${days} hari sebelumnya`;
  return `${d > 0 ? 'Naik' : 'Turun'} ${Math.abs(d)} poin dari ${days} hari sebelumnya`;
}
const prevTotal = (v: number | null, days: number) => (v === null ? undefined : `${days} hari sebelumnya: ${formatNumber(v)}`);

export function PeriodSummary({ days, current: c, previous: p }: Props) {
  const compliance = (label: string, k: 'ph' | 'tss') => (
    <Stat label={label} value={c[k].compliant_pct === null ? null : `${c[k].compliant_pct}%`} bad={c[k].violations > 0}
      subs={[`${c[k].violations} dari ${c[k].checked} hari melanggar`, pctChange(c[k].compliant_pct, p[k].compliant_pct, days)]} />
  );
  return (
    <section aria-label={`Ringkasan ${days} hari`} className="ui-stats">
      {compliance('Patuh pH', 'ph')}
      {compliance('Patuh TSS', 'tss')}
      <Stat label="Hari no flow" value={String(c.noflow_days)} subs={[`${days} hari sebelumnya: ${p.noflow_days}`]} />
      <Stat label="Total hujan" value={c.rain_total_mm === null ? null : formatNumber(c.rain_total_mm)} unit="mm" subs={[prevTotal(p.rain_total_mm, days)]} />
      <Stat label="Koagulan keluar" value={c.coag_out_kg === null ? null : formatNumber(c.coag_out_kg)} unit="kg" subs={[prevTotal(p.coag_out_kg, days)]} />
    </section>
  );
}
