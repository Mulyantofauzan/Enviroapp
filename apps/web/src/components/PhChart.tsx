import { formatNumber, isOutOfLimit, type Threshold } from '@evo/shared';

export type PhPoint = { date: string; ph_inlet: number | null; ph_outlet: number | null };

const W = 340, H = 220, L = 30, R = 12, T = 12, B = 28;

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

function bandLabel(b: Threshold) {
  if (b.min !== null && b.max !== null) return `Baku mutu ${formatNumber(b.min)}-${formatNumber(b.max)}`;
  return b.max !== null ? `Baku mutu (maks. ${formatNumber(b.max)})` : `Baku mutu (min. ${formatNumber(b.min)})`;
}

export function PhChart({ series, band }: { series: PhPoint[]; band: Threshold | undefined }) {
  const values = series.flatMap((s) => [s.ph_inlet, s.ph_outlet]).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const hasBand = !!band && (band.min !== null || band.max !== null);
  const lows = [...values, ...(hasBand && band!.min !== null ? [band!.min] : [])];
  const highs = [...values, ...(hasBand && band!.max !== null ? [band!.max] : [])];
  let lo = Math.floor(Math.min(...lows) - 0.5);
  let hi = Math.ceil(Math.max(...highs) + 0.5);
  if (hi - lo < 2) hi = lo + 2;
  const n = series.length;
  const iw = W - L - R, ih = H - T - B;
  const x = (i: number) => (n === 1 ? L + iw / 2 : L + (i * iw) / (n - 1));
  const y = (v: number) => T + ih - ((v - lo) / (hi - lo)) * ih;
  const step = hi - lo > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  const every = Math.ceil(n / 7);

  const line = (key: 'ph_inlet' | 'ph_outlet', name: string, cls: string) =>
    runs(series.map((s, i) => ({ x: x(i), y: s[key] === null ? null : y(s[key] as number) }))).map((r, k) =>
      r.length > 1 ? <path key={`${name}${k}`} data-line={name} className={cls} fill="none" d={r.map((p, j) => `${j ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')} /> : null);

  const lastOut = [...series].reverse().find((s) => s.ph_outlet !== null)?.ph_outlet ?? null;
  const label = `Grafik pH inlet dan outlet, ${n} hari.${lastOut !== null ? ` Nilai outlet terakhir ${formatNumber(lastOut)}.` : ''}`;

  return (
    <figure className="ui-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {hasBand && (
          <rect data-band className="ui-chart__band" x={L} width={iw}
            y={band!.max !== null ? y(band!.max) : T} height={(band!.min !== null ? y(band!.min) : T + ih) - (band!.max !== null ? y(band!.max) : T)} />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line className="ui-chart__grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="ui-chart__tick" x={L - 6} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {series.map((s, i) => (i % every === 0 || i === n - 1) && (
          <text key={s.date} className="ui-chart__tick" x={x(i)} y={H - 8} textAnchor="middle">{Number(s.date.slice(8))}</text>
        ))}
        {line('ph_inlet', 'inlet', 'ui-chart__inlet')}
        {line('ph_outlet', 'outlet', 'ui-chart__outlet')}
        {series.map((s, i) => {
          if (s.ph_outlet === null) return null;
          const bad = hasBand && isOutOfLimit(s.ph_outlet, band);
          return bad
            ? <circle key={s.date} data-abnormal className="ui-chart__bad" cx={x(i)} cy={y(s.ph_outlet)} r={6} />
            : <circle key={s.date} className="ui-chart__dot" cx={x(i)} cy={y(s.ph_outlet)} r={4} />;
        })}
      </svg>
      <ul className="ui-legend">
        <li><i className="ui-legend__line ui-legend__line--outlet" />Outlet</li>
        <li><i className="ui-legend__line ui-legend__line--inlet" />Inlet</li>
        {hasBand && <li><i className="ui-legend__band" />{bandLabel(band!)}</li>}
        {hasBand && <li><i className="ui-legend__bad" />Abnormal</li>}
      </ul>
      <table className="ui-sr">
        <caption>Data pH per hari</caption>
        <thead><tr><th>Tanggal</th><th>pH inlet</th><th>pH outlet</th></tr></thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.date}><td>{s.date}</td><td>{formatNumber(s.ph_inlet)}</td><td>{formatNumber(s.ph_outlet)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
