import { describe, it, expect } from 'vitest';
import { barOption, chartTheme, noFlowRuns, trendOption, trendRange, type TrendPoint } from './chartOptions';

const theme = chartTheme();
const d = (n: number, inlet: number | null, outlet: number | null, noFlow?: boolean): TrendPoint => ({ date: `2026-11-0${n}`, inlet, outlet, noFlow });
const tss = [d(1, 120, 30), d(2, 180, 38), d(3, 250, 55), d(4, 90, 20), d(5, 110, 41)];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const opt = (o: unknown) => o as Any;
const outlet = (o: unknown) => opt(o).series.find((s: Any) => s.name === 'Outlet');
const labels = (s: Any) => s.data.filter((i: Any) => i.label?.show).map((i: Any) => i.label.formatter());

describe('trendRange', () => {
  it('keeps the band inside the scale and never goes below zero when asked', () => {
    const r = trendRange([30, 55], { min: null, max: 40 }, true);
    expect(r.lo).toBeGreaterThanOrEqual(0);
    expect(r.hi).toBeGreaterThanOrEqual(55);
  });
  it('gives at least two steps of range', () => {
    const r = trendRange([7, 7], undefined);
    expect(r.hi - r.lo).toBeGreaterThanOrEqual(r.step * 2);
  });
});

describe('trendOption', () => {
  it('marks outlet values above a maximum limit as abnormal (red) and draws a band', () => {
    const o = outlet(trendOption({ series: tss, limit: { min: null, max: 40 }, floorZero: true, theme }));
    const red = o.data.filter((i: Any) => i.itemStyle?.color === theme.danger);
    expect(red).toHaveLength(2); // 55 and 41
    expect(o.markArea.data.some((a: Any) => a[0].yAxis !== undefined)).toBe(true);
  });
  it('without a limit there is no band and no abnormal mark', () => {
    const o = outlet(trendOption({ series: tss, limit: undefined, theme }));
    expect(o.data.filter((i: Any) => i.itemStyle?.color === theme.danger)).toHaveLength(0);
    expect(o.markArea.data).toHaveLength(0);
  });
  it('a missing day is a null point, never zero, and the line is not connected across it', () => {
    const o = outlet(trendOption({ series: [tss[0], tss[1], d(3, null, null), tss[3]], limit: undefined, theme }));
    expect(o.data[2][1]).toBeNull();
    expect(o.connectNulls).toBe(false);
  });
  it('a no-flow day is a grey area, not a value, and not abnormal', () => {
    const series = [d(1, 7, 7.5), d(2, 7, 0, true), d(3, 7, 7.2)];
    const o = outlet(trendOption({ series, limit: { min: 6, max: 9 }, theme }));
    expect(o.data[1][1]).toBeNull();
    expect(o.data.filter((i: Any) => i.itemStyle?.color === theme.danger)).toHaveLength(0);
    const areas = o.markArea.data.filter((a: Any) => a[0].xAxis !== undefined);
    expect(areas).toHaveLength(1);
    expect(areas[0][1].xAxis).toBeGreaterThan(areas[0][0].xAxis);
  });
  it('keeps no-flow zeros out of the scale', () => {
    const series = [d(1, null, 7.5), d(2, null, 0, true), d(3, null, 7.2)];
    const x = opt(trendOption({ series, limit: undefined, floorZero: true, hideInlet: true, theme }));
    expect(x.yAxis.min).toBeGreaterThan(0);
  });
  it('labels every point when there are few, in id-ID format; outlet above, inlet below', () => {
    const x = opt(trendOption({ series: tss, limit: undefined, decimals: 1, theme }));
    const out = x.series.find((s: Any) => s.name === 'Outlet'), inn = x.series.find((s: Any) => s.name === 'Inlet');
    expect(labels(out)).toHaveLength(5);
    expect(out.data[1].label.position).toBe('top');
    expect(inn.data[1].label.position).toBe('bottom');
  });
  it('beyond 14 points only four outlet labels are drawn', () => {
    const long = Array.from({ length: 20 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, inlet: null, outlet: 10 + (i % 5) }));
    const n = labels(outlet(trendOption({ series: long, limit: undefined, theme }))).length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(4);
  });
  it('does not repeat an inlet label equal to the outlet label', () => {
    const x = opt(trendOption({ series: [d(1, 7, 7), d(2, 7, 7)], limit: undefined, theme }));
    expect(labels(x.series.find((s: Any) => s.name === 'Inlet'))).toHaveLength(0);
  });
  it('hideInlet leaves only the outlet series, named by the given label', () => {
    const x = opt(trendOption({ series: tss, limit: undefined, hideInlet: true, outletLabel: 'Debit outlet (L/s)', theme }));
    expect(x.series.map((s: Any) => s.name)).toEqual(['Debit outlet (L/s)']);
  });
});

describe('noFlowRuns', () => {
  it('groups consecutive no-flow days, including a run at the end', () => {
    const s = [d(1, 1, 1), d(2, 1, 0, true), d(3, 1, 0, true), d(4, 1, 1), d(5, 1, 0, true)];
    expect(noFlowRuns(s)).toEqual([[1, 2], [4, 4]]);
  });
});

const cats = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `L${i}`, partial: i === n - 1 }));
const barLabels = (s: Any) => s.data.filter((i: Any) => i?.label?.show).map((i: Any) => i.label.formatter());

describe('barOption', () => {
  it('single series: one label per category, id-ID format, null is a gap', () => {
    const x = opt(barOption({ categories: cats(5), series: [{ name: 'a', values: [1.5, 2, null, 4.25, 3] }], theme }));
    expect(barLabels(x.series[0])).toEqual(['1,5', '2', '4,3', '3']);
    expect(x.series[0].data[2]).toBeNull();
  });
  it('a real zero stays a zero value with a label', () => {
    const x = opt(barOption({ categories: cats(2), series: [{ name: 'a', values: [0, 5] }], theme }));
    expect(x.series[0].data[0].value).toBe(0);
    expect(barLabels(x.series[0])[0]).toBe('0');
  });
  it('grouped bars with many values label only four per series', () => {
    const vals = (b: number) => Array.from({ length: 7 }, (_, i) => b + i);
    const x = opt(barOption({ categories: cats(7), series: [{ name: 'a', values: vals(1) }, { name: 'b', values: vals(10) }, { name: 'c', values: vals(20) }], theme }));
    for (const s of x.series) expect(barLabels(s).length).toBeLessThanOrEqual(4);
  });
  it('hideZeroLabels drops the label on dry days but keeps the bar value', () => {
    const x = opt(barOption({ categories: cats(3), series: [{ name: 'a', values: [0, 5, 0] }], hideZeroLabels: true, theme }));
    expect(barLabels(x.series[0])).toEqual(['5']);
    expect(x.series[0].data[0].value).toBe(0);
  });
  it('marks the running period with a star and a lighter bar', () => {
    const x = opt(barOption({ categories: cats(3), series: [{ name: 'a', values: [10, 20, 5] }], theme }));
    expect(x.xAxis.data[2]).toContain('L2*');
    expect(x.series[0].data[2].itemStyle.opacity).toBeLessThan(1);
    expect(x.series[0].data[0].itemStyle).toBeUndefined();
  });
  it('an empty category is marked with a dash under its label', () => {
    const x = opt(barOption({ categories: cats(3), series: [{ name: 'a', values: [1, null, 3] }], theme }));
    expect(x.xAxis.data[1]).toContain('–');
  });
  it('thins wide labels but always keeps the last one', () => {
    const wide = cats(12).map((c) => ({ ...c, label: `${c.label}xxxx` }));
    const x = opt(barOption({ categories: wide, series: [{ name: 'a', values: Array.from({ length: 12 }, (_, i) => i + 1) }], theme }));
    const shown = wide.map((_, i) => x.xAxis.axisLabel.interval(i));
    expect(shown[11]).toBe(true);
    expect(shown[10]).toBe(false);
  });
  it('the axis always starts at zero and covers the largest value', () => {
    const x = opt(barOption({ categories: cats(2), series: [{ name: 'a', values: [10, 23] }], theme }));
    expect(x.yAxis.min).toBe(0);
    expect(x.yAxis.max).toBeGreaterThanOrEqual(23);
  });
});
