import { lazy, Suspense } from 'react';
import type { ChartOption } from '../lib/echarts';

// ECharts is large, so it loads as its own chunk the first time a chart is shown. Input screens never pay for it.
const Impl = lazy(() => import('./EChartImpl').then((m) => ({ default: m.EChartImpl })));

type Props = { option: ChartOption; height?: number; label: string };

export function EChart({ height = 220, label, ...rest }: Props) {
  return (
    <Suspense fallback={<div className="ui-echart" style={{ height }} role="img" aria-label={label} />}>
      <Impl height={height} label={label} {...rest} />
    </Suspense>
  );
}
