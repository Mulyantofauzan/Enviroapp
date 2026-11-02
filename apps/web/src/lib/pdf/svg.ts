import { formatNumber } from '@evo/shared';
import { clean, niceStep } from '../scale';
import { xmlEscape } from '../xlsx';
import type { Pt } from './pages';

export type Theme = { panel: string; border: string; tag: string };
export const WEATHER_THEME: Theme = { panel: '#F8E4D8', border: '#D9261C', tag: '#E5322D' };
export const POND_THEME: Theme = { panel: '#D6E8C2', border: '#7DB04B', tag: '#14306B' };

const FONT = 'Helvetica, Arial, sans-serif';
const INK = '#1A1A1A';
const GRID = '#9AA39A';
const CHAR_W = 5.4;

type Scale = { hi: number; ticks: number[] };

/** Axis from zero to a "nice" top that is at least one step high, so an empty or all-zero series never divides by zero. */
function scaleFor(max: number): Scale {
  const step = niceStep(Math.max(max, 0));
  const hi = Math.max(step, clean(Math.ceil(max / step - 1e-9) * step));
  const ticks: number[] = [];
  for (let t = 0; t <= hi + 1e-9; t = clean(t + step)) ticks.push(t);
  return { hi, ticks };
}
const maxOf = (vals: Pt[]) => Math.max(0, ...vals.filter((v): v is number => v !== null));
const tickW = (s: Scale) => Math.max(...s.ticks.map((t) => formatNumber(t).length)) * 6 + 8;
const esc = xmlEscape;
const n2 = (v: number) => Math.round(v * 100) / 100;

function frame(o: { width: number; height: number; title: string; theme: Theme; tag: boolean }, body: string): string {
  const { width: W, height: H, theme } = o;
  const tagW = Math.min(W - 20, o.title.length * 6.4 + 22);
  const tag = o.tag
    ? `<g data-tag="1"><rect x="${n2((W - tagW) / 2)}" y="3" width="${n2(tagW)}" height="19" fill="${theme.tag}"/><text x="${W / 2}" y="16.5" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="bold" fill="#FFFFFF">${esc(o.title)}</text></g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="${theme.panel}" stroke="${theme.border}" stroke-width="1"/>${tag}${body}</svg>`;
}

type LegendItem = { name: string; color: string; kind: 'box' | 'line' };
function legend(items: LegendItem[], W: number, y: number): string {
  const widths = items.map((i) => i.name.length * CHAR_W + 26);
  let x = Math.max(6, (W - widths.reduce((a, b) => a + b, 0)) / 2);
  const parts = items.map((it, i) => {
    const sw = it.kind === 'line'
      ? `<line x1="${n2(x)}" x2="${n2(x + 16)}" y1="${y}" y2="${y}" stroke="${it.color}" stroke-width="2"/>`
      : `<rect x="${n2(x)}" y="${y - 4}" width="14" height="8" fill="${it.color}"/>`;
    const t = `<text x="${n2(x + 19)}" y="${y + 3.5}" font-family="${FONT}" font-size="9" fill="${INK}">${esc(it.name)}</text>`;
    x += widths[i];
    return sw + t;
  });
  return `<g data-legend="1">${parts.join('')}</g>`;
}

function axisText(x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end', fill = INK): string {
  return `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}" font-family="${FONT}" font-size="9" fill="${fill}">${esc(text)}</text>`;
}

export function barChartSvg(o: {
  width: number; height: number; title: string; theme: Theme; categories: string[];
  series: { name: string; color: string; values: Pt[] }[]; lines?: { name: string; color: string; value: number }[]; decimals?: number;
}): string {
  const { width: W, height: H } = o;
  const decimals = o.decimals ?? 1;
  const lines = o.lines ?? [];
  const sc = scaleFor(Math.max(...o.series.map((s) => maxOf(s.values)), ...lines.map((l) => l.value), 0));
  const L = tickW(sc), R = 10, T = 32, B = 46;
  const iw = W - L - R, ih = H - T - B;
  const n = Math.max(1, o.categories.length), k = Math.max(1, o.series.length);
  const slot = iw / n;
  const bw = Math.max(3, Math.min(30, (slot * 0.8) / k));
  const y = (v: number) => T + ih - (v / sc.hi) * ih;
  const out: string[] = [];

  for (const t of sc.ticks) {
    out.push(`<line x1="${L}" x2="${W - R}" y1="${n2(y(t))}" y2="${n2(y(t))}" stroke="${GRID}" stroke-width="0.4"/>`);
    out.push(axisText(L - 5, y(t) + 3, formatNumber(t), 'end'));
  }
  o.categories.forEach((c, i) => out.push(axisText(L + slot * i + slot / 2, T + ih + 12, c, 'middle')));
  o.series.forEach((s, si) => s.values.forEach((v, i) => {
    if (v === null) return;
    const x = L + slot * i + (slot - bw * k) / 2 + bw * si;
    out.push(`<rect data-bar="1" x="${n2(x)}" y="${n2(y(v))}" width="${n2(bw - (k > 1 ? 0.5 : 0))}" height="${n2(T + ih - y(v))}" fill="${s.color}"/>`);
  }));
  o.series.forEach((s, si) => s.values.forEach((v, i) => {
    if (v === null) return;
    const cx = L + slot * i + (slot - bw * k) / 2 + bw * si + bw / 2;
    out.push(`<text data-label="1" x="${n2(cx)}" y="${n2(y(v) - 3)}" text-anchor="middle" font-family="${FONT}" font-size="8.5" font-weight="bold" fill="${INK}">${esc(formatNumber(v, decimals))}</text>`);
  }));
  for (const l of lines) out.push(`<line data-limit="1" x1="${L}" x2="${W - R}" y1="${n2(y(l.value))}" y2="${n2(y(l.value))}" stroke="${l.color}" stroke-width="1.6"/>`);
  out.push(legend([
    ...o.series.map((s): LegendItem => ({ name: s.name, color: s.color, kind: 'box' })),
    ...lines.map((l): LegendItem => ({ name: l.name, color: l.color, kind: 'line' })),
  ], W, H - 12));
  return frame({ ...o, tag: true }, out.join(''));
}

export function lineChartSvg(o: {
  width: number; height: number; title: string; theme: Theme; categories: string[];
  series: { name: string; color: string; values: Pt[]; axis?: 'left' | 'right' }[]; decimals?: number; legend?: boolean; tag?: boolean;
}): string {
  const { width: W, height: H } = o;
  const decimals = o.decimals ?? 1;
  const showTag = o.tag !== false, showLegend = o.legend !== false;
  const side = (s: { axis?: 'left' | 'right' }) => (s.axis === 'right' ? 'right' : 'left');
  const scales = {
    left: scaleFor(Math.max(...o.series.filter((s) => side(s) === 'left').map((s) => maxOf(s.values)), 0)),
    right: scaleFor(Math.max(...o.series.filter((s) => side(s) === 'right').map((s) => maxOf(s.values)), 0)),
  };
  const hasRight = o.series.some((s) => side(s) === 'right');
  const L = tickW(scales.left), R = hasRight ? tickW(scales.right) : 12;
  const T = showTag ? 38 : 16, B = showLegend ? 46 : 26;
  const iw = W - L - R, ih = H - T - B;
  const n = Math.max(1, o.categories.length);
  const slot = iw / n;
  const x = (i: number) => L + slot * i + slot / 2;
  const y = (v: number, sc: Scale) => T + ih - (v / sc.hi) * ih;
  const out: string[] = [];

  for (const t of scales.left.ticks) {
    out.push(`<line x1="${L}" x2="${W - R}" y1="${n2(y(t, scales.left))}" y2="${n2(y(t, scales.left))}" stroke="${GRID}" stroke-width="0.4"/>`);
    out.push(axisText(L - 5, y(t, scales.left) + 3, formatNumber(t), 'end', o.series.find((s) => side(s) === 'left')?.color ?? INK));
  }
  if (hasRight) for (const t of scales.right.ticks) out.push(axisText(W - R + 5, y(t, scales.right) + 3, formatNumber(t), 'start', o.series.find((s) => side(s) === 'right')!.color));
  o.categories.forEach((c, i) => out.push(axisText(x(i), T + ih + 12, c, 'middle')));

  o.series.forEach((s, si) => {
    const sc = scales[side(s)];
    let seg: string[] = [];
    const flush = () => { if (seg.length > 1) out.push(`<path data-series="${si}" d="${seg.join(' ')}" fill="none" stroke="${s.color}" stroke-width="1.8" stroke-linejoin="round"/>`); seg = []; };
    s.values.forEach((v, i) => {
      if (v === null) { flush(); return; }
      seg.push(`${seg.length ? 'L' : 'M'}${n2(x(i))} ${n2(y(v, sc))}`);
    });
    flush();
    s.values.forEach((v, i) => { if (v !== null) out.push(`<circle data-series="${si}" cx="${n2(x(i))}" cy="${n2(y(v, sc))}" r="2.6" fill="${s.color}"/>`); });
  });
  o.series.forEach((s, si) => {
    const sc = scales[side(s)];
    s.values.forEach((v, i) => {
      if (v === null) return;
      const text = formatNumber(v, decimals);
      const w = text.length * 5.8 + 7, h = 12;
      const bx = Math.min(W - 2 - w, Math.max(2, x(i) - w / 2));
      const by = si === 0 ? y(v, sc) - 6 - h : y(v, sc) + 6;
      out.push(`<g data-label="1"><rect x="${n2(bx)}" y="${n2(by)}" width="${n2(w)}" height="${h}" fill="${s.color}"/><text x="${n2(bx + w / 2)}" y="${n2(by + 9)}" text-anchor="middle" font-family="${FONT}" font-size="8.5" font-weight="bold" fill="#FFFFFF">${esc(text)}</text></g>`);
    });
  });
  if (showLegend) out.push(legend(o.series.map((s): LegendItem => ({ name: s.name, color: s.color, kind: 'line' })), W, H - 12));
  return frame({ ...o, tag: showTag }, out.join(''));
}
