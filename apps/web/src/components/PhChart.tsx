import type { Threshold } from '@evo/shared';
import { TrendChart } from './TrendChart';

export type PhPoint = { date: string; ph_inlet: number | null; ph_outlet: number | null; noFlow?: boolean };

export function PhChart({ series, band }: { series: PhPoint[]; band: Threshold | undefined }) {
  return <TrendChart name="pH" series={series.map((s) => ({ date: s.date, inlet: s.ph_inlet, outlet: s.ph_outlet, noFlow: s.noFlow }))} limit={band} decimals={2} />;
}
