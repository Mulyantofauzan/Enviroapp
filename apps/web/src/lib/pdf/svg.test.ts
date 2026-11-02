import { describe, it, expect } from 'vitest';
import { POND_THEME, WEATHER_THEME, barChartSvg, lineChartSvg } from './svg';

const parse = (s: string) => {
  const doc = new DOMParser().parseFromString(s, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc;
};
const days = ['19-Oct', '20-Oct', '21-Oct', '22-Oct', '23-Oct', '24-Oct', '25-Oct'];
const bar = (over: object = {}) => barChartSvg({
  width: 340, height: 210, title: 'pH Monitoring', theme: POND_THEME, categories: days,
  series: [
    { name: 'pH Inlet', color: '#14306B', values: [6.5, 6.4, 4.4, null, null, null, 0] },
    { name: 'pH Outlet', color: '#F5B83D', values: [7, 7.2, 7.1, null, null, null, 0] },
  ], ...over,
});

describe('barChartSvg', () => {
  it('draws one bar per recorded value and a label with id-ID decimals', () => {
    const doc = parse(bar());
    expect(doc.querySelectorAll('rect[data-bar]')).toHaveLength(8);
    const labels = [...doc.querySelectorAll('text[data-label]')].map((t) => t.textContent);
    expect(labels).toContain('4,4');
    expect(labels.filter((t) => t === '0')).toHaveLength(2);
    expect(labels).toHaveLength(8);
  });

  it('draws a red limit line and legend entry per `lines`, none otherwise', () => {
    const withLines = parse(bar({ lines: [{ name: 'pH Min', color: '#E5322D', value: 6 }, { name: 'pH Max', color: '#E5322D', value: 9 }] }));
    const ls = [...withLines.querySelectorAll('line[data-limit]')];
    expect(ls).toHaveLength(2);
    expect(ls[0].getAttribute('stroke')).toBe('#E5322D');
    expect(withLines.documentElement.textContent).toContain('pH Min');
    const without = parse(bar());
    expect(without.querySelectorAll('line[data-limit]')).toHaveLength(0);
    expect(without.documentElement.textContent).not.toContain('pH Min');
  });

  it('survives all-null and all-zero data without NaN or Infinity', () => {
    for (const values of [days.map(() => null), days.map(() => 0)]) {
      const s = bar({ series: [{ name: 'x', color: '#000', values }] });
      expect(s).not.toMatch(/NaN|Infinity/);
      expect(parse(s).querySelectorAll('line').length).toBeGreaterThan(0);
    }
  });

  it('escapes special characters in the title and keeps emoji', () => {
    const doc = parse(bar({ title: 'A & B < C > "D" 😀' }));
    expect(doc.documentElement.textContent).toContain('A & B < C > "D" 😀');
  });

  it('is standalone: xmlns, viewBox, no class attributes, no var()', () => {
    const s = bar();
    expect(s).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(s).toContain('viewBox="0 0 340 210"');
    expect(s).not.toMatch(/\sclass=/);
    expect(s).not.toContain('var(');
  });

  it('uses the theme colours for the panel', () => {
    expect(bar()).toContain(POND_THEME.panel);
    expect(bar({ theme: WEATHER_THEME })).toContain(WEATHER_THEME.border);
  });
});

const line = (over: object = {}) => lineChartSvg({
  width: 270, height: 200, title: 'Rainfall (1W)', theme: WEATHER_THEME, categories: days,
  series: [
    { name: 'Rainfall (mm)', color: '#E5322D', values: [10, 20, null, 5, 8, 0, 4] },
    { name: 'Duration (hrs)', color: '#14306B', values: [1, 2, null, 1, 3, 0, 1], axis: 'right' },
  ], ...over,
});

describe('lineChartSvg', () => {
  it('gives each series its own path pieces, split at a null', () => {
    const doc = parse(line());
    expect(doc.querySelectorAll('path[data-series="0"]')).toHaveLength(2);
  });

  it('labels every recorded point', () => {
    const doc = parse(line());
    expect(doc.querySelectorAll('g[data-label]')).toHaveLength(12);
  });

  it('scales a right-axis series on its own', () => {
    const doc = parse(line());
    const top = (i: number) => Math.min(...[...doc.querySelectorAll(`circle[data-series="${i}"]`)].map((c) => Number(c.getAttribute('cy'))));
    // 20 mm and 3 hrs would sit far apart on one shared scale; on their own scales both peaks reach the same height.
    expect(top(1)).toBeCloseTo(top(0), 5);
  });

  it('survives all-null and all-zero series without NaN or Infinity', () => {
    for (const values of [days.map(() => null), days.map(() => 0)]) {
      const s = line({ series: [{ name: 'x', color: '#000', values }] });
      expect(s).not.toMatch(/NaN|Infinity/);
      expect(parse(s).querySelectorAll('line').length).toBeGreaterThan(0);
    }
  });

  it('can drop the title tag and the legend', () => {
    const full = parse(line());
    expect(full.querySelector('[data-tag]')).not.toBeNull();
    expect(full.querySelector('[data-legend]')).not.toBeNull();
    const bare = parse(line({ tag: false, legend: false }));
    expect(bare.querySelector('[data-tag]')).toBeNull();
    expect(bare.querySelector('[data-legend]')).toBeNull();
  });

  it('is standalone and class-free', () => {
    const s = line();
    expect(s).not.toMatch(/\sclass=/);
    expect(s).not.toContain('var(');
  });
});
