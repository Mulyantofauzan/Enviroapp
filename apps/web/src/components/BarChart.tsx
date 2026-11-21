import { useMemo } from 'react';
import { formatNumber } from '@evo/shared';
import { barOption, type BarCategory, type BarSeries } from '../lib/chartOptions';
import { EChart } from './EChart';

export type { BarCategory, BarSeries };

type Props = { name: string; unit: string; categories: BarCategory[]; series: BarSeries[]; decimals?: number; /** Smallest top of the axis, so tiny values do not fill the whole chart. */ minMax?: number; /** Short note drawn top right, before the running-period mark. */ footnote?: string };

/** Single or grouped bars with a number on top. Missing values leave a gap, never a zero bar. */
export function BarChart({ name, unit, categories, series, decimals = 1, minMax = 1, footnote }: Props) {
  const option = useMemo(() => barOption({ categories, series, decimals, minMax }), [categories, series, decimals, minMax]);
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (all.length === 0) return <p className="ui-muted">Belum ada data pada rentang ini.</p>;
  const hasGap = series.some((s) => s.values.some((v) => v === null));
  const last = [...series[series.length - 1].values].reverse().find((v) => v !== null) ?? null;
  const aria = `Grafik ${name}, satuan ${unit}. Nilai tertinggi ${formatNumber(Math.max(...all), decimals)}${last !== null ? `, terakhir ${formatNumber(last, decimals)}` : ''}.`;
  const foot = [footnote, categories.some((c) => c.partial) ? '* periode berjalan' : ''].filter(Boolean).join(' · ');

  return (
    <figure className="ui-chart" data-report-chart>
      {foot && <p className="ui-chart__foot">{foot}</p>}
      <EChart option={option} label={aria} height={categories.some((c) => c.sub) ? 230 : 210} />
      <ul className="ui-legend">
        {series.map((s, si) => <li key={s.name}><i className={`ui-legend__bar ui-legend__bar--${si}`} />{s.name}</li>)}
        {hasGap && <li><b aria-hidden>–</b>belum ada data</li>}
      </ul>
      <table className="ui-sr">
        <caption>Data {name} ({unit})</caption>
        <thead><tr><th>Periode</th>{series.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
        <tbody>
          {categories.map((c, i) => (
            <tr key={c.key}><td>{c.partial ? `${c.label} (berjalan)` : c.label}</td>{series.map((s) => <td key={s.name}>{formatNumber(s.values[i], decimals)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
