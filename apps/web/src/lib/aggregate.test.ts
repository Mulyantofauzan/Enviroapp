import { describe, it, expect } from 'vitest';
import { meanByWeek, sumByWeek, meanByMonth, sumByMonth, type DayValue } from './aggregate';

const d = (date: string, value: number | null): DayValue => ({ date, value });
const TODAY = '2026-11-02'; // Monday

describe('weeks', () => {
  it('5 buckets, Monday keys, oldest first', () => {
    const b = meanByWeek([], TODAY);
    expect(b.map((x) => x.key)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
    expect(b[0].label).toBe('5 Okt');
  });
  it('mean only counts days that have data', () => {
    const b = meanByWeek([d('2026-10-26', 10), d('2026-10-27', null), d('2026-10-28', 20)], TODAY);
    expect(b[3].value).toBe(15);
  });
  it('a week with no data is a gap, not zero', () => {
    expect(meanByWeek([d('2026-10-26', 4)], TODAY)[0].value).toBeNull();
    expect(sumByWeek([d('2026-10-26', 4)], TODAY)[0].value).toBeNull();
  });
  it('ignores days after today', () => {
    expect(meanByWeek([d('2026-11-02', 6), d('2026-11-03', 100)], TODAY)[4].value).toBe(6);
  });
  it('current week is partial unless today is Sunday', () => {
    expect(meanByWeek([], TODAY)[4].partial).toBe(true);
    expect(meanByWeek([], TODAY)[3].partial).toBe(false);
    const sun = meanByWeek([], '2026-11-01');
    expect(sun[4].key).toBe('2026-10-26');
    expect(sun[4].partial).toBe(false);
  });
  it('sum adds up and keeps a real zero', () => {
    const b = sumByWeek([d('2026-10-26', 3), d('2026-10-27', 4), d('2026-10-19', 0)], TODAY);
    expect(b[3].value).toBe(7);
    expect(b[2].value).toBe(0);
  });
  it('crosses the year boundary', () => {
    const b = meanByWeek([d('2025-12-31', 8), d('2026-01-02', 4)], '2026-01-06');
    expect(b.map((x) => x.key)).toEqual(['2025-12-08', '2025-12-15', '2025-12-22', '2025-12-29', '2026-01-05']);
    expect(b[3].value).toBe(6);
  });
});

describe('months', () => {
  it('12 buckets across the year boundary with short labels', () => {
    const b = meanByMonth([], '2026-01-15');
    expect(b.length).toBe(12);
    expect(b[0].key).toBe('2025-02');
    expect(b[11].key).toBe('2026-01');
    expect(b[11].label).toBe('Jan 26');
    expect(b[0].label).toBe('Feb 25');
  });
  it('current month partial unless today is its last day', () => {
    expect(meanByMonth([], '2026-01-15')[11].partial).toBe(true);
    expect(meanByMonth([], '2026-01-31')[11].partial).toBe(false);
    expect(meanByMonth([], '2026-01-15')[10].partial).toBe(false);
  });
  it('mean and sum per month', () => {
    const days = [d('2025-12-01', 2), d('2025-12-02', 4), d('2025-12-03', null), d('2026-01-10', 9)];
    expect(meanByMonth(days, '2026-01-15')[10].value).toBe(3);
    expect(sumByMonth(days, '2026-01-15')[10].value).toBe(6);
    expect(sumByMonth(days, '2026-01-15')[9].value).toBeNull();
    expect(sumByMonth(days, '2026-01-15')[11].value).toBe(9);
  });
});
