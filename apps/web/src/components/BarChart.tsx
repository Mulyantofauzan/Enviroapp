import { formatNumber } from '@evo/shared';
import { labelAnchor, labeledIndexes } from '../lib/labels';
import { clean, niceStep } from '../lib/scale';

export type BarCategory = { key: string; label: string; partial?: boolean };
export type BarSeries = { name: string; values: (number | null)[] };

const W = 340, H = 210, R = 12, T = 18, B = 28;
const MAX_LABELS = 14;

type Props = { name: string; unit: string; categories: BarCategory[]; series: BarSeries[]; decimals?: number };

/** Single or grouped bars with a number on top. Missing values leave a gap, never a zero bar. */
export function BarChart({ name, unit, categories, series, decimals = 1 }: Props) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (all.length === 0) return <p className="ui-muted">Belum ada data pada rentang ini.</p>;
  const max = Math.max(...all, 1);
  const step = niceStep(max);
  const hi = clean(Math.ceil(max / step) * step);
  const n = categories.length, k = series.length;
  const ticks: number[] = [];
  for (let t = 0; t <= hi + 1e-9; t = clean(t + step)) ticks.push(t);
  const L = Math.max(38, Math.max(...ticks.map((t) => formatNumber(t).length)) * 6 + 10);
  const iw = W - L - R, ih = H - T - B;
  const slot = iw / n;
  const bw = Math.max(3, Math.min(34, (slot * 0.8) / k));
  const groupW = bw * k;
  const y = (v: number) => T + ih - (v / hi) * ih;
  const every = Math.ceil(n / 6);
  const perSeriesRule = all.length > MAX_LABELS;
  const shown = series.map((s) => (perSeriesRule ? labeledIndexes(s.values, 0) : new Set(s.values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0))));
  const last = [...series[series.length - 1].values].reverse().find((v) => v !== null) ?? null;
  const aria = `Grafik ${name}, satuan ${unit}. Nilai tertinggi ${formatNumber(Math.max(...all), decimals)}${last !== null ? `, terakhir ${formatNumber(last, decimals)}` : ''}.`;

  return (
    <figure className="ui-chart" data-report-chart>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="ui-chart__grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="ui-chart__tick" x={L - 6} y={y(t) + 4} textAnchor="end">{formatNumber(t)}</text>
          </g>
        ))}
        {categories.map((c, i) => (i === n - 1 || (i % every === 0 && n - 1 - i >= every)) && (
          <text key={c.key} className="ui-chart__tick" x={L + slot * i + slot / 2} y={H - 8} textAnchor="middle">{c.partial ? `${c.label}*` : c.label}</text>
        ))}
        {series.map((s, si) => s.values.map((v, i) => {
          if (v === null) return null;
          const x0 = L + slot * i + (slot - groupW) / 2 + bw * si;
          return <rect key={`${si}-${i}`} data-bar className={`ui-chart__bar ui-chart__bar--${si}${categories[i].partial ? ' ui-chart__bar--partial' : ''}`} rx={2} x={x0} width={bw - (k > 1 ? 1 : 0)} y={y(v)} height={T + ih - y(v)} />;
        }))}
        {series.map((s, si) => s.values.map((v, i) => {
          if (v === null || !shown[si].has(i)) return null;
          const cx = L + slot * i + (slot - groupW) / 2 + bw * si + bw / 2;
          const t = formatNumber(v, decimals);
          return <text key={`l${si}-${i}`} className="ui-chart__label" x={cx} y={y(v) - 5} textAnchor={labelAnchor(cx, L, W - R, t.length * 6.5)}>{t}</text>;
        }))}
        {categories.some((c) => c.partial) && <text className="ui-chart__foot" x={W - R} y={11} textAnchor="end">* periode berjalan</text>}
      </svg>
      <ul className="ui-legend">
        {series.map((s, si) => <li key={s.name}><i className={`ui-legend__bar ui-legend__bar--${si}`} />{s.name}</li>)}
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
