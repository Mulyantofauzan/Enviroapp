import { formatNumber } from '@evo/shared';

export type RainPoint = { date: string; value: number | null };

const W = 340, H = 200, L = 38, R = 12, T = 12, B = 28;

function niceStep(range: number): number {
  const rough = range / 4 || 1;
  const p = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= rough - 1e-9) return m * p;
  return 10 * p;
}
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

export function RainChart({ series }: { series: RainPoint[] }) {
  const vals = series.map((s) => s.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  const max = Math.max(...vals, 1);
  const step = niceStep(max);
  const hi = clean(Math.ceil(max / step) * step);
  const n = series.length;
  const iw = W - L - R, ih = H - T - B;
  const slot = iw / n;
  const bw = Math.max(2, slot * 0.7);
  const y = (v: number) => T + ih - (v / hi) * ih;
  const ticks: number[] = [];
  for (let t = 0; t <= hi + 1e-9; t = clean(t + step)) ticks.push(t);
  const every = Math.ceil(n / 7);
  const total = vals.reduce((a, b) => a + b, 0);

  return (
    <figure className="ui-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Grafik curah hujan, ${n} hari. Total ${formatNumber(total)} mm.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="ui-chart__grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="ui-chart__tick" x={L - 6} y={y(t) + 4} textAnchor="end">{formatNumber(t)}</text>
          </g>
        ))}
        {series.map((s, i) => (i % every === 0 || i === n - 1) && (
          <text key={s.date} className="ui-chart__tick" x={L + slot * i + slot / 2} y={H - 8} textAnchor="middle">{Number(s.date.slice(8))}</text>
        ))}
        {series.map((s, i) => s.value === null ? null : (
          <rect key={s.date} data-bar className="ui-chart__bar" rx={2} x={L + slot * i + (slot - bw) / 2} width={bw}
            y={y(s.value)} height={T + ih - y(s.value)} />
        ))}
      </svg>
      <ul className="ui-legend"><li><i className="ui-legend__bar" />Curah hujan (mm)</li></ul>
      <table className="ui-sr">
        <caption>Data curah hujan per hari</caption>
        <thead><tr><th>Tanggal</th><th>Curah hujan (mm)</th></tr></thead>
        <tbody>{series.map((s) => <tr key={s.date}><td>{s.date}</td><td>{formatNumber(s.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
