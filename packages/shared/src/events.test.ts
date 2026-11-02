import { describe, it, expect } from 'vitest';
import { dueDates, isDueDate, todayInSite, eventStatus, isLate, EVENT_FREQUENCIES, FREQUENCY_LABEL, type ScheduleRule } from './events';

const rule = (frequency: ScheduleRule['frequency'], start_date: string, ended_on: string | null = null): ScheduleRule => ({ frequency, start_date, ended_on });

describe('dueDates', () => {
  it('daily returns every day in range', () =>
    expect(dueDates(rule('Daily', '2026-11-01'), '2026-11-03', '2026-11-05')).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']));
  it('weekly returns every 7th day from the start', () =>
    expect(dueDates(rule('Weekly', '2026-11-02'), '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']));
  it('monthly on the 31st lands on month ends without drifting', () =>
    expect(dueDates(rule('Monthly', '2026-01-31'), '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']));
  it('monthly on the 29th keeps the leap day in leap years', () => {
    const d = dueDates(rule('Monthly', '2028-01-29'), '2028-01-01', '2029-03-01');
    expect(d).toContain('2028-02-29');
    expect(d).toContain('2029-02-28');
    expect(d).toContain('2029-01-29');
  });
  it('quarterly from the 30th', () =>
    expect(dueDates(rule('Quarterly', '2026-11-30'), '2026-11-01', '2027-06-30')).toEqual(['2026-11-30', '2027-02-28', '2027-05-30']));
  it('semi-annual from the 31st', () =>
    expect(dueDates(rule('Semi-Annual', '2026-08-31'), '2026-08-01', '2027-03-01')).toEqual(['2026-08-31', '2027-02-28']));
  it('annual from a leap day', () =>
    expect(dueDates(rule('Annual', '2028-02-29'), '2028-01-01', '2032-12-31')).toEqual(['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']));
  it('nothing before the start date', () =>
    expect(dueDates(rule('Daily', '2026-11-10'), '2026-11-01', '2026-11-12')).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']));
  it('ended_on cuts off later dates', () =>
    expect(dueDates(rule('Daily', '2026-11-08', '2026-11-10'), '2026-11-01', '2026-11-30')).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']));
  it('an empty or inverted range is empty', () => {
    expect(dueDates(rule('Daily', '2026-11-01'), '2026-11-05', '2026-11-04')).toEqual([]);
    expect(dueDates(rule('Daily', '2026-12-01'), '2026-11-01', '2026-11-30')).toEqual([]);
  });
  it('a long range stays bounded', () =>
    expect(dueDates(rule('Daily', '2000-01-01'), '2000-01-01', '2100-01-01').length).toBeLessThanOrEqual(20000));
});

describe('isDueDate', () => {
  it('true on a due date, false off it', () => {
    expect(isDueDate(rule('Weekly', '2026-11-02'), '2026-11-09')).toBe(true);
    expect(isDueDate(rule('Weekly', '2026-11-02'), '2026-11-10')).toBe(false);
    expect(isDueDate(rule('Weekly', '2026-11-02'), '2026-10-26')).toBe(false);
  });
  it('false after the schedule ended', () => expect(isDueDate(rule('Daily', '2026-11-01', '2026-11-05'), '2026-11-06')).toBe(false));
});

describe('todayInSite (WITA, UTC+8)', () => {
  it('16:30 UTC is already the next day', () => expect(todayInSite(new Date('2026-11-02T16:30:00Z'))).toBe('2026-11-03'));
  it('15:59 UTC is still the same day', () => expect(todayInSite(new Date('2026-11-02T15:59:00Z'))).toBe('2026-11-02'));
});

describe('eventStatus and isLate', () => {
  it('overdue / today / upcoming / done', () => {
    expect(eventStatus('2026-11-01', '2026-11-02', null)).toBe('overdue');
    expect(eventStatus('2026-11-02', '2026-11-02', null)).toBe('today');
    expect(eventStatus('2026-11-03', '2026-11-02', null)).toBe('upcoming');
    expect(eventStatus('2026-11-01', '2026-11-02', '2026-11-02')).toBe('done');
  });
  it('late only when completed after the due date', () => {
    expect(isLate('2026-11-01', '2026-11-02')).toBe(true);
    expect(isLate('2026-11-02', '2026-11-02')).toBe(false);
    expect(isLate('2026-11-02', null)).toBe(false);
  });
});

describe('constants', () => {
  it('frequencies and labels', () => {
    expect([...EVENT_FREQUENCIES]).toEqual(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual']);
    expect(FREQUENCY_LABEL['Quarterly']).toBe('3-Bulanan');
    expect(FREQUENCY_LABEL['Semi-Annual']).toBe('6-Bulanan');
  });
});
