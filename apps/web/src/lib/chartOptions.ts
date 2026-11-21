import { formatNumber, isOutOfLimit, type Threshold } from '@evo/shared';
import { dateText, dayMonth } from './dates';
import { labeledIndexes } from './labels';
import { clean, niceStep } from './scale';
import type { ChartOption } from './echarts';

export type TrendPoint = { date: string; inlet: number | null; outlet: number | null; noFlow?: boolean };
export type BarCategory = { key: string; label: string; partial?: boolean; /** Second, smaller line under the label (a year, for instance). */ sub?: string };
export type BarSeries = { name: string; values: (number | null)[] };

export type ChartTheme = { primary: string; water: string; warning: string; danger: string; text: string; sub: string; border: string; surface: string; band: string };

const FALLBACK: ChartTheme = { primary: '#0e7c66', water: '#1c7ed6', warning: '#d97706', danger: '#d92d20', text: '#12201c', sub: '#5e6e69', border: '#dae3e0', surface: '#ffffff', band: '#ddf5e6' };

/** Colours come from the app's CSS tokens, so the charts follow the rest of the UI. */
export function chartTheme(): ChartTheme {
  if (typeof document === 'undefined') return FALLBACK;
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
  return {
    primary: v('--primary', FALLBACK.primary), water: v('--water', FALLBACK.water), warning: v('--warning', FALLBACK.warning), danger: v('--danger', FALLBACK.danger),
    text: v('--text', FALLBACK.text), sub: v('--text-sub', FALLBACK.sub), border: v('--border', FALLBACK.border), surface: v('--surface', FALLBACK.surface), band: v('--success-soft', FALLBACK.band),
  };
}

const DAY = 86_400_000;
const FONT = 'Inter, system-ui, -apple-system, sans-serif';
const ts = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Axis bounds with a half step of air on both sides, and the band always inside the scale. */
export function trendRange(values: number[], limit: Threshold | undefined, floorZero?: boolean) {
  const vals = values.length ? values : [0, 1];
  const hasBand = !!limit && (limit.min !== null || limit.max !== null);
  const lows = [...vals, ...(hasBand && limit!.min !== null ? [limit!.min] : [])];
  const highs = [...vals, ...(hasBand && limit!.max !== null ? [limit!.max] : [])];
  const dataMin = Math.min(...lows), dataMax = Math.max(...highs);
  const step = niceStep(dataMax - dataMin, 5);
  let lo = clean(Math.floor((dataMin - step * 0.5) / step) * step);
  let hi = clean(Math.ceil((dataMax + step * 0.5) / step) * step);
  if (floorZero && lo < 0) lo = 0;
  if (hi - lo < step * 2) hi = clean(lo + step * 2);
  return { lo, hi, step };
}

export function noFlowRuns(series: TrendPoint[]): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  series.forEach((s, i) => {
    if (s.noFlow && start < 0) start = i;
    if (start >= 0 && (!s.noFlow || i === series.length - 1)) { out.push([start, s.noFlow ? i : i - 1]); start = -1; }
  });
  return out;
}

const baseTooltip = (t: ChartTheme) => ({
  trigger: 'axis' as const, confine: true, transitionDuration: 0,
  backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, padding: [8, 10],
  textStyle: { color: t.text, fontSize: 12, fontFamily: FONT },
  extraCssText: 'border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.15)',
});
const dot = (color: string) => `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></i>`;
const tipRow = (color: string, name: string, value: string) =>
  `<div style="display:flex;gap:14px;justify-content:space-between"><span>${dot(color)}${name}</span><b>${value}</b></div>`;

type TrendInput = { series: TrendPoint[]; limit: Threshold | undefined; floorZero?: boolean; decimals?: number; hideInlet?: boolean; inletLabel?: string; outletLabel?: string; theme?: ChartTheme };

export function trendOption({ series, limit, floorZero, decimals = 1, hideInlet, inletLabel = 'Inlet', outletLabel = 'Outlet', theme = chartTheme() }: TrendInput): ChartOption {
  const t = theme;
  const n = series.length;
  const outOf = (s: TrendPoint) => (s.noFlow ? null : s.outlet);
  const hasBand = !!limit && (limit.min !== null || limit.max !== null);
  const values = series.flatMap((s) => (hideInlet ? [outOf(s)] : [s.inlet, outOf(s)])).filter((v): v is number => v !== null);
  const { lo, hi, step } = trendRange(values, limit, floorZero);
  const dense = n > 14;
  const fmt = (v: number) => formatNumber(v, decimals);

  const lastOutIdx = (() => { for (let i = n - 1; i >= 0; i--) if (outOf(series[i]) !== null) return i; return -1; })();
  const outIdx = labeledIndexes(series.map(outOf));
  const inIdx = hideInlet ? new Set<number>() : labeledIndexes(series.map((s) => s.inlet));

  const outData = series.map((s, i) => {
    const v = outOf(s);
    if (v === null) return [ts(s.date), null];
    const bad = hasBand && isOutOfLimit(v, limit);
    const item: Record<string, unknown> = { value: [ts(s.date), v] };
    if (bad) { item.symbol = 'circle'; item.symbolSize = 9; item.itemStyle = { color: t.danger, borderColor: t.surface, borderWidth: 2 }; }
    else if (!dense || i === lastOutIdx) { item.symbol = 'circle'; item.symbolSize = dense ? 9 : 7; item.itemStyle = { color: t.primary, borderColor: t.surface, borderWidth: 2 }; }
    if (outIdx.has(i)) item.label = { show: true, position: 'top', distance: 6, color: bad ? t.danger : t.text, fontWeight: bad ? 700 : 600, fontSize: 11, formatter: () => fmt(v) };
    return item;
  });
  const inData = series.map((s, i) => {
    const v = s.inlet;
    if (v === null) return [ts(s.date), null];
    const item: Record<string, unknown> = { value: [ts(s.date), v] };
    if (!dense) { item.symbol = 'circle'; item.symbolSize = 6; item.itemStyle = { color: t.water, borderColor: t.surface, borderWidth: 1.5 }; }
    const same = outOf(s) !== null && fmt(outOf(s)!) === fmt(v);
    if (inIdx.has(i) && !same) item.label = { show: true, position: 'bottom', distance: 6, color: t.sub, fontSize: 11, formatter: () => fmt(v) };
    return item;
  });

  const areas = noFlowRuns(series).map(([a, b]) => [
    { xAxis: ts(series[a].date) - DAY / 2, itemStyle: { color: 'rgba(120,130,125,.16)' } },
    { xAxis: ts(series[b].date) + DAY / 2 },
  ]);
  const bandArea = hasBand ? [[{ yAxis: limit!.min ?? lo, itemStyle: { color: t.band } }, { yAxis: limit!.max ?? hi }]] : [];

  const common = { type: 'line', symbol: 'none', connectNulls: false, lineStyle: { width: 2.5, cap: 'round', join: 'round' }, emphasis: { focus: 'none' } };
  const outlet = { ...common, name: outletLabel, data: outData, z: 3, lineStyle: { ...common.lineStyle, color: t.primary }, itemStyle: { color: t.primary },
    markArea: { silent: true, data: [...bandArea, ...areas] } };
  const inlet = { ...common, name: inletLabel, data: inData, z: 2, lineStyle: { ...common.lineStyle, color: t.water }, itemStyle: { color: t.water } };

  const labelOf = (v: number) => {
    const d = isoOf(v);
    if (n <= 7) return `${new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short' }).format(new Date(v))} ${Number(d.slice(8))}`;
    return d.endsWith('-01') ? dayMonth(d) : String(Number(d.slice(8)));
  };

  return {
    animation: false,
    useUTC: true,
    grid: { left: 6, right: 16, top: 26, bottom: 6, containLabel: true },
    xAxis: {
      type: 'time', min: ts(series[0].date) - DAY / 2, max: ts(series[n - 1].date) + DAY / 2, splitNumber: n <= 7 ? 7 : 6,
      axisLine: { lineStyle: { color: t.border } }, axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { color: t.sub, fontSize: 11, fontFamily: FONT, hideOverlap: true, margin: 10, showMinLabel: false, showMaxLabel: false, formatter: labelOf },
      axisPointer: { lineStyle: { color: t.sub, type: 'solid', width: 1 } },
    },
    yAxis: {
      type: 'value', min: lo, max: hi, interval: step,
      axisLabel: { color: t.sub, fontSize: 11, fontFamily: FONT, formatter: (v: number) => formatNumber(v) },
      axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: t.border, opacity: 0.6 } },
    },
    tooltip: {
      ...baseTooltip(t), axisPointer: { type: 'line', snap: true },
      formatter: (ps: { axisValue: number; value: [number, number | null]; seriesName: string; color: string }[]) => {
        const day = isoOf(ps[0].axisValue);
        const head = `<div style="color:${t.sub};margin-bottom:4px">${dateText(day)}</div>`;
        const row = series.find((s) => s.date === day);
        if (row?.noFlow) return `${head}<div>No flow (tidak ada aliran)</div>`;
        return head + ps.filter((p) => p.value?.[1] != null).map((p) => tipRow(p.color, p.seriesName, fmt(p.value[1] as number))).join('');
      },
    },
    series: hideInlet ? [outlet] : [inlet, outlet],
  };
}

type BarInput = { categories: BarCategory[]; series: BarSeries[]; decimals?: number; minMax?: number; /** Dry days are common in rainfall; a "0" on each one is noise. */ hideZeroLabels?: boolean; theme?: ChartTheme };
const MAX_LABELS = 14;

export function barOption({ categories, series, decimals = 1, minMax = 1, hideZeroLabels, theme = chartTheme() }: BarInput): ChartOption {
  const t = theme;
  const colors = [t.primary, t.water, t.warning];
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const max = Math.max(...all, minMax);
  const step = niceStep(max);
  const hi = clean(Math.ceil(max / step) * step);
  const n = categories.length;
  const slot = 290 / n;
  const widest = Math.max(...categories.map((c) => c.label.length + (c.partial ? 1 : 0)), ...categories.map((c) => c.sub?.length ?? 0));
  const every = Math.max(1, Math.ceil((widest * 5 + 2) / slot));
  const perSeriesRule = all.length > MAX_LABELS;
  const fmt = (v: number) => formatNumber(v, decimals);

  const catLabel = (c: BarCategory, i: number) => {
    const empty = series.every((s) => s.values[i] === null);
    return `${c.partial ? `${c.label}*` : c.label}${c.sub ? `\n{sub|${c.sub}}` : ''}${empty ? '\n{sub|–}' : ''}`;
  };

  return {
    animation: false,
    grid: { left: 6, right: 12, top: 16, bottom: 6, containLabel: true },
    xAxis: {
      type: 'category', data: categories.map(catLabel),
      axisLine: { lineStyle: { color: t.border } }, axisTick: { show: false },
      axisLabel: {
        color: t.sub, fontSize: 11, fontFamily: FONT, margin: 10, lineHeight: 14, rich: { sub: { color: t.sub, fontSize: 10, lineHeight: 14 } },
        interval: (i: number) => i === n - 1 || (i % every === 0 && n - 1 - i >= every),
      },
    },
    yAxis: {
      type: 'value', min: 0, max: hi, interval: step,
      axisLabel: { color: t.sub, fontSize: 11, fontFamily: FONT, formatter: (v: number) => formatNumber(v) },
      axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: t.border, opacity: 0.6 } },
    },
    tooltip: {
      ...baseTooltip(t), axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(120,130,125,.12)' } },
      formatter: (ps: { dataIndex: number; seriesName: string; color: string; value: number | null }[]) => {
        const c = categories[ps[0].dataIndex];
        const head = `<div style="color:${t.sub};margin-bottom:4px">${c.label}${c.sub ? ` ${c.sub}` : ''}${c.partial ? ' (berjalan)' : ''}</div>`;
        return head + ps.map((p) => tipRow(p.color, p.seriesName, p.value == null ? '–' : fmt(p.value))).join('');
      },
    },
    series: series.map((s, si) => {
      const shown = perSeriesRule ? labeledIndexes(s.values, 0) : new Set(s.values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0));
      return {
        name: s.name, type: 'bar', barMaxWidth: 34, barGap: '8%', barCategoryGap: '25%', emphasis: { itemStyle: { opacity: 0.85 } },
        itemStyle: { color: colors[si % colors.length], borderRadius: [3, 3, 0, 0] },
        data: s.values.map((v, i) => {
          if (v === null) return null;
          const item: Record<string, unknown> = { value: v };
          if (categories[i].partial) item.itemStyle = { color: colors[si % colors.length], opacity: 0.55, borderRadius: [3, 3, 0, 0] };
          if (shown.has(i) && !(hideZeroLabels && v === 0)) item.label = { show: true, position: 'top', distance: 4, color: t.text, fontWeight: 600, fontSize: 11, formatter: () => fmt(v) };
          return item;
        }),
      };
    }),
  };
}
