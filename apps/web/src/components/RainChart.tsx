import { useMemo } from 'react';
import { formatNumber } from '@evo/shared';
import { barOption } from '../lib/chartOptions';
import { dayMonth } from '../lib/dates';
import { EChart } from './EChart';

export type RainPoint = { date: string; value: number | null };

export function RainChart({ series }: { series: RainPoint[] }) {
  const option = useMemo(() => barOption({
    categories: series.map((s, i) => ({ key: s.date, label: i === 0 || s.date.endsWith('-01') ? dayMonth(s.date) : String(Number(s.date.slice(8))) })),
    series: [{ name: 'Curah hujan (mm)', values: series.map((s) => s.value) }],
    hideZeroLabels: true,
  }), [series]);
  const vals = series.map((s) => s.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  const total = vals.reduce((a, b) => a + b, 0);

  return (
    <figure className="ui-chart">
      <EChart option={option} height={200} label={`Grafik curah hujan, ${series.length} hari. Total ${formatNumber(total)} mm.`} />
      <ul className="ui-legend"><li><i className="ui-legend__bar ui-legend__bar--0" />Curah hujan (mm)</li></ul>
      <table className="ui-sr">
        <caption>Data curah hujan per hari</caption>
        <thead><tr><th>Tanggal</th><th>Curah hujan (mm)</th></tr></thead>
        <tbody>{series.map((s) => <tr key={s.date}><td>{s.date}</td><td>{formatNumber(s.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
