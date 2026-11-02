import { describe, it, expect } from 'vitest';
import { KG_PER_BAG, bags, dayLabel, isoWeek, lastDays, lastMonths, lastWeeks, monthShortEn } from './dates';

describe('isoWeek', () => {
  it.each([
    ['2024-12-30', 1], ['2026-01-01', 1], ['2020-12-31', 53], ['2026-10-25', 43], ['2026-10-19', 43],
  ])('%s is W%i', (d, w) => expect(isoWeek(d)).toBe(w));
});

describe('labels', () => {
  it('formats days and months in English', () => {
    expect(dayLabel('2026-10-19')).toBe('19-Oct');
    expect(monthShortEn('2026-10')).toBe('Oct');
  });
});

describe('windows', () => {
  it('lastDays ends at `to`, ascending', () => {
    const d = lastDays('2026-10-25', 7);
    expect(d[0]).toBe('2026-10-19');
    expect(d[6]).toBe('2026-10-25');
  });
  it('lastWeeks gives W39..W43 with full last week', () => {
    const w = lastWeeks('2026-10-25', 5);
    expect(w.map((x) => x.label)).toEqual(['W39', 'W40', 'W41', 'W42', 'W43']);
    expect(w[4].days).toBe(7);
    expect(w[4].monday).toBe('2026-10-19');
  });
  it('lastWeeks counts elapsed days in the running week', () => {
    const w = lastWeeks('2026-10-21', 5);
    expect(w[4].days).toBe(3);
    expect(w[3].days).toBe(7);
  });
  it('lastMonths spans the year boundary', () => {
    const m = lastMonths('2026-02-10', 12);
    expect(m).toHaveLength(12);
    expect(m[0].month).toBe('2025-03');
    expect(m[11]).toEqual({ month: '2026-02', label: 'Feb' });
  });
});

describe('bags', () => {
  it('converts kg to bags with one decimal', () => {
    expect(KG_PER_BAG).toBe(25);
    expect(bags(25)).toBe(1);
    expect(bags(100)).toBe(4);
    expect(bags(30)).toBe(1.2);
    expect(bags(0)).toBe(0);
  });
});
