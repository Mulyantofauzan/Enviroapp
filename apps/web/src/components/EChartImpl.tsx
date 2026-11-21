import { useEffect, useRef } from 'react';
import { echarts, type ChartOption } from '../lib/echarts';

type Props = { option: ChartOption; height?: number; label: string };

/** Mounts one ECharts instance, keeps it sized to its box and disposes it on unmount. Pass a memoised `option`. */
export function EChartImpl({ option, height = 220, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    const el = box.current!;
    const c = echarts.init(el, undefined, { renderer: 'svg', width: el.clientWidth || 340, height });
    chart.current = c;
    c.setOption(option, true);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => c.resize({ width: el.clientWidth || 340, height }));
    ro?.observe(el);
    return () => { ro?.disconnect(); c.dispose(); chart.current = null; };
    // The instance is rebuilt only when the height changes; option updates go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  useEffect(() => { chart.current?.setOption(option, true); }, [option]);

  return <div ref={box} className="ui-echart" style={{ height }} role="img" aria-label={label} />;
}
