import { formatNumber, isOutOfLimit, type Threshold } from '@evo/shared';
import { dayMonth } from '../lib/dates';
import { labelAnchor, labeledIndexes } from '../lib/labels';

export type TrendPoint = { date: string; inlet: number | null; outlet: number | null; noFlow?: boolean };

const W = 340, H = 220, R = 12, T = 12, B = 28;
const L_MIN = 38;

/** Runs of consecutive non-null values, so a missing day breaks the line instead of drawing zero. */
function runs(pts: { x: number; y: number | null }[]) {
  const out: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  for (const p of pts) {
    if (p.y === null) { if (cur.length) out.push(cur); cur = []; } else cur.push({ x: p.x, y: p.y });
  }
  if (cur.length) out.push(cur);
  return out;
}

/** 1, 2, 2.5, 5 times a power of ten, giving about five axis steps. */
function niceStep(range: number): number {
  const rough = range / 5 || 1;
  const p = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= rough - 1e-9) return m * p;
  return 10 * p;
}
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

function bandLabel(b: Threshold) {
  if (b.min !== null && b.max !== null) return `Baku mutu ${formatNumber(b.min)}-${formatNumber(b.max)}`;
  return b.max !== null ? `Baku mutu (maks. ${formatNumber(b.max)})` : `Baku mutu (min. ${formatNumber(b.min)})`;
}

type Props = {
  name: string; unit?: string; series: TrendPoint[]; limit: Threshold | undefined; floorZero?: boolean;
  /** Decimals shown on data labels (trailing zeros are dropped). */
  decimals?: number;
  hide?: 'inlet'; outletLabel?: string; inletLabel?: string;
};

export function TrendChart({ name, series, limit, floorZero, decimals = 1, hide, outletLabel = 'Outlet', inletLabel = 'Inlet' }: Props) {
  const showInlet = hide !== 'inlet';
  const hasNoFlow = series.some((s) => s.noFlow);
  // A no-flow day has no reading. It is drawn as a marker on the baseline, never as a value on the scale or the line.
  const outOf = (s: TrendPoint) => (s.noFlow ? null : s.outlet);
  const values = series.flatMap((s) => (showInlet ? [s.inlet, outOf(s)] : [outOf(s)])).filter((v): v is number => v !== null);
  if (values.length === 0 && !hasNoFlow) return null;
  if (values.length === 0) values.push(0, 1);
  const hasBand = !!limit && (limit.min !== null || limit.max !== null);
  const lows = [...values, ...(hasBand && limit!.min !== null ? [limit!.min] : [])];
  const highs = [...values, ...(hasBand && limit!.max !== null ? [limit!.max] : [])];
  const dataMin = Math.min(...lows), dataMax = Math.max(...highs);
  const step = niceStep(dataMax - dataMin);
  let lo = clean(Math.floor((dataMin - step * 0.5) / step) * step);
  let hi = clean(Math.ceil((dataMax + step * 0.5) / step) * step);
  if (floorZero && lo < 0) lo = 0;
  if (hi - lo < step * 2) hi = clean(lo + step * 2);
  const n = series.length;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t = clean(t + step)) ticks.push(t);
  // Wide numbers (five digits) need more room on the left, or the axis labels are cut off.
  const L = Math.max(L_MIN, Math.max(...ticks.map((t) => formatNumber(t).length)) * 6 + 10);
  const iw = W - L - R, ih = H - T - B;
  const x = (i: number) => (n === 1 ? L + iw / 2 : L + (i * iw) / (n - 1));
  const y = (v: number) => T + ih - ((v - lo) / (hi - lo)) * ih;
  const every = Math.ceil(n / 7);
  const dense = n > 14;
  const base = T + ih;

  const line = (key: 'inlet' | 'outlet', cls: string) =>
    runs(series.map((s, i) => { const v = key === 'outlet' ? outOf(s) : s.inlet; return { x: x(i), y: v === null ? null : y(v) }; })).map((r, k) =>
      r.length > 1 ? <path key={`${key}${k}`} data-line={key} className={cls} fill="none" d={r.map((p, j) => `${j ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')} /> : null);

  const lastOut = [...series].reverse().find((s) => outOf(s) !== null)?.outlet ?? null;
  const label = showInlet
    ? `Grafik ${name} inlet dan outlet, ${n} hari.${lastOut !== null ? ` Nilai outlet terakhir ${formatNumber(lastOut)}.` : ''}`
    : `Grafik ${name}, ${n} hari.${lastOut !== null ? ` Nilai terakhir ${formatNumber(lastOut)}.` : ''}`;
  const outIdx = labeledIndexes(series.map(outOf));
  const inIdx = showInlet ? labeledIndexes(series.map((s) => s.inlet)) : new Set<number>();
  const text = (v: number, xi: number, yy: number, key: string, cls: string) => {
    const t = formatNumber(v, decimals);
    return <text key={key} className={cls} x={xi} y={yy} textAnchor={labelAnchor(xi, L, W - R, t.length * 6.5)}>{t}</text>;
  };

  return (
    <figure className="ui-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {hasBand && (
          <rect data-band className="ui-chart__band" x={L} width={iw}
            y={limit!.max !== null ? y(limit!.max) : T} height={(limit!.min !== null ? y(limit!.min) : T + ih) - (limit!.max !== null ? y(limit!.max) : T)} />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line className="ui-chart__grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="ui-chart__tick" x={L - 6} y={y(t) + 4} textAnchor="end">{formatNumber(t)}</text>
          </g>
        ))}
        {series.map((s, i) => (i % every === 0 || i === n - 1) && (
          <text key={s.date} className="ui-chart__tick" x={x(i)} y={H - 8} textAnchor={i === 0 ? labelAnchor(x(i), L, W - R, 36) : 'middle'}>{i === 0 ? dayMonth(s.date) : Number(s.date.slice(8))}</text>
        ))}
        {showInlet && line('inlet', 'ui-chart__inlet')}
        {line('outlet', 'ui-chart__outlet')}
        {showInlet && series.map((s, i) => {
          const v = s.inlet;
          if (v === null || series[i - 1]?.inlet != null || series[i + 1]?.inlet != null) return null;
          return <circle key={`i${s.date}`} data-inlet-dot className="ui-chart__idot" cx={x(i)} cy={y(v)} r={3.5} />;
        })}
        {series.map((s, i) => {
          if (s.noFlow) return <circle key={s.date} data-noflow className="ui-chart__noflow" cx={x(i)} cy={base} r={dense ? 3 : 4.5} />;
          if (s.outlet === null) return null;
          const bad = hasBand && isOutOfLimit(s.outlet, limit);
          return bad
            ? <circle key={s.date} data-abnormal className="ui-chart__bad" cx={x(i)} cy={y(s.outlet)} r={dense ? 4 : 6} />
            : <circle key={s.date} className={`ui-chart__dot${dense ? ' ui-chart__dot--small' : ''}`} cx={x(i)} cy={y(s.outlet)} r={dense ? 2.5 : 4} />;
        })}
        {series.map((s, i) => outIdx.has(i) && s.outlet !== null
          && text(s.outlet, x(i), y(s.outlet) - 9, `lo${s.date}`, `ui-chart__label${hasBand && !s.noFlow && isOutOfLimit(s.outlet, limit) ? ' ui-chart__label--bad' : ''}`))}
        {series.map((s, i) => inIdx.has(i) && s.inlet !== null && !(outOf(s) !== null && formatNumber(outOf(s), decimals) === formatNumber(s.inlet, decimals))
          && text(s.inlet, x(i), y(s.inlet) + 16, `li${s.date}`, 'ui-chart__label ui-chart__label--inlet'))}
      </svg>
      <ul className="ui-legend">
        <li><i className="ui-legend__line ui-legend__line--outlet" />{outletLabel}</li>
        {showInlet && <li><i className="ui-legend__line ui-legend__line--inlet" />{inletLabel}</li>}
        {hasBand && <li><i className="ui-legend__band" />{bandLabel(limit!)}</li>}
        {hasBand && <li><i className="ui-legend__bad" />Abnormal</li>}
        {series.some((s) => s.noFlow) && <li><i className="ui-legend__noflow" />No flow (tidak ada aliran)</li>}
      </ul>
      <table className="ui-sr">
        <caption>Data {name} per hari</caption>
        <thead><tr><th>Tanggal</th>{showInlet && <th>{name} inlet</th>}<th>{outletLabel === 'Outlet' ? `${name} outlet` : outletLabel}</th></tr></thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.date}><td>{s.date}</td>{showInlet && <td>{formatNumber(s.inlet)}</td>}<td>{s.noFlow ? 'No flow' : formatNumber(s.outlet)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
