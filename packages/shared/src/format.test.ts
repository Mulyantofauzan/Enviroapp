import { describe, it, expect } from 'vitest';
import { formatNumber, formatDateId, parseLocaleNumber, ROLE_LABEL } from './format';
import { THRESHOLD_KEYS } from './types';

describe('formatNumber', () => {
  it('uses id-ID separators', () => expect(formatNumber(1278.72, 1)).toBe('1.278,7'));
  it('decimal comma', () => expect(formatNumber(12.5)).toBe('12,5'));
  it('integer without decimals', () => expect(formatNumber(260)).toBe('260'));
  it('null is a dash', () => expect(formatNumber(null)).toBe('–'));
  it('negative', () => expect(formatNumber(-3)).toBe('-3'));
});
describe('formatDateId', () => {
  it('weekday, day, short month, year', () => expect(formatDateId('2026-11-02')).toBe('Senin, 2 Nov 2026'));
});
describe('parseLocaleNumber', () => {
  it('comma decimal', () => expect(parseLocaleNumber('7,2')).toBe(7.2));
  it('dot decimal', () => expect(parseLocaleNumber('7.2')).toBe(7.2));
  it('thousands separator is rejected', () => expect(parseLocaleNumber('1.278,7')).toBe('invalid'));
  it('blank is null', () => expect(parseLocaleNumber('')).toBeNull());
  it('text is invalid', () => expect(parseLocaleNumber('abc')).toBe('invalid'));
  it('negative', () => expect(parseLocaleNumber('-3,5')).toBe(-3.5));
});
describe('constants', () => {
  it('threshold keys are outlet only', () => expect([...THRESHOLD_KEYS]).toEqual(['ph_outlet', 'tss_outlet']));
  it('role labels', () => expect(ROLE_LABEL.Operator).toBe('Operator Lapangan'));
});
