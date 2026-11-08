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

const prevTotal = (v: number | null, days: number) => (v === null ? undefined : `${days} hari sebelumnya: ${formatNumber(v)}`);

export function PeriodSummary({ days, current: c, previous: p }: Props) {
  return (
    <section aria-label={`Ringkasan ${days} hari`} className="ui-stats">
      <Stat label="Hari no flow" value={String(c.noflow_days)} subs={[`${days} hari sebelumnya: ${p.noflow_days}`]} />
      <Stat label="Total hujan" value={c.rain_total_mm === null ? null : formatNumber(c.rain_total_mm)} unit="mm" subs={[prevTotal(p.rain_total_mm, days)]} />
      <Stat label="Koagulan keluar" value={c.coag_out_kg === null ? null : formatNumber(c.coag_out_kg)} unit="kg" subs={[prevTotal(p.coag_out_kg, days)]} />
    </section>
  );
}
