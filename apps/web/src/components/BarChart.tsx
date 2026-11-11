import { formatNumber } from '@evo/shared';
import { labelAnchor, labeledIndexes } from '../lib/labels';
import { clean, niceStep } from '../lib/scale';

export type BarCategory = { key: string; label: string; partial?: boolean; /** Second, smaller line under the label (a year, for instance). */ sub?: string };
export type BarSeries = { name: string; values: (number | null)[] };

const W = 340, R = 12, T = 18;
const MAX_LABELS = 14;

type Props = { name: string; unit: string; categories: BarCategory[]; series: BarSeries[]; decimals?: number; /** Smallest top of the axis, so tiny values do not fill the whole chart. */ minMax?: number; /** Short note drawn top right, before the running-period mark. */ footnote?: string };

/** Single or grouped bars with a number on top. Missing values leave a gap, never a zero bar. */
export function BarChart({ name, unit, categories, series, decimals = 1, minMax = 1, footnote }: Props) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (all.length === 0) return <p className="ui-muted">Belum ada data pada rentang ini.</p>;
  const max = Math.max(...all, minMax);
  const hasSub = categories.some((c) => c.sub);
  const B = hasSub ? 40 : 28, H = 182 + B;
  const hasGap = series.some((s) => s.values.some((v) => v === null));
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
  // Show every label when they fit in a slot, otherwise thin them out so none print on top of another.
  const widest = Math.max(...categories.map((c) => c.label.length + (c.partial ? 1 : 0)), ...categories.map((c) => c.sub?.length ?? 0));
  const every = Math.max(1, Math.ceil((widest * 5 + 2) / slot));
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
          <text key={c.key} className="ui-chart__tick" x={L + slot * i + slot / 2} y={T + ih + 15} textAnchor="middle">
            {c.partial ? `${c.label}*` : c.label}
            {c.sub && <tspan className="ui-chart__sub" x={L + slot * i + slot / 2} dy={13}>{c.sub}</tspan>}
          </text>
        ))}
        {categories.map((c, i) => series.every((s) => s.values[i] === null) && (
          <text key={`g${c.key}`} data-nodata className="ui-chart__nodata" x={L + slot * i + slot / 2} y={T + ih - 5} textAnchor="middle">–</text>
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
        {(footnote || categories.some((c) => c.partial)) && (
          <text className="ui-chart__foot" x={W - R} y={11} textAnchor="end">{[footnote, categories.some((c) => c.partial) ? '* periode berjalan' : ''].filter(Boolean).join(' · ')}</text>
        )}
      </svg>
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
