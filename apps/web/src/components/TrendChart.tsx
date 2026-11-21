import { useMemo } from 'react';
import { formatNumber, type Threshold } from '@evo/shared';
import { trendOption, type TrendPoint } from '../lib/chartOptions';
import { EChart } from './EChart';

export type { TrendPoint };

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
  const hasValue = series.some((s) => (showInlet && s.inlet !== null) || (!s.noFlow && s.outlet !== null));
  const hasBand = !!limit && (limit.min !== null || limit.max !== null);
  const option = useMemo(
    () => (series.length ? trendOption({ series, limit, floorZero, decimals, hideInlet: !showInlet, inletLabel, outletLabel }) : null),
    [series, limit, floorZero, decimals, showInlet, inletLabel, outletLabel],
  );
  if ((!hasValue && !hasNoFlow) || !option) return null;

  const n = series.length;
  const lastOut = [...series].reverse().find((s) => !s.noFlow && s.outlet !== null)?.outlet ?? null;
  const label = showInlet
    ? `Grafik ${name} inlet dan outlet, ${n} hari.${lastOut !== null ? ` Nilai outlet terakhir ${formatNumber(lastOut)}.` : ''}`
    : `Grafik ${name}, ${n} hari.${lastOut !== null ? ` Nilai terakhir ${formatNumber(lastOut)}.` : ''}`;

  return (
    <figure className="ui-chart">
      <EChart option={option} label={label} />
      <ul className="ui-legend">
        <li><i className="ui-legend__line ui-legend__line--outlet" />{outletLabel}</li>
        {showInlet && <li><i className="ui-legend__line ui-legend__line--inlet" />{inletLabel}</li>}
        {hasBand && <li><i className="ui-legend__band" />{bandLabel(limit!)}</li>}
        {hasBand && <li><i className="ui-legend__bad" />Abnormal</li>}
        {hasNoFlow && <li><i className="ui-legend__noflow" />No flow (tidak ada aliran)</li>}
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
