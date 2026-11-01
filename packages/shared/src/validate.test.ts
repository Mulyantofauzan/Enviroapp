import { describe, it, expect } from 'vitest';
import { parseNumber, isValidDate, canWrite, isAdmin } from './validate';

describe('parseNumber', () => {
  it('blank is null', () => { expect(parseNumber('')).toBeNull(); expect(parseNumber('  ')).toBeNull(); });
  it('null/undefined are null', () => { expect(parseNumber(null)).toBeNull(); expect(parseNumber(undefined)).toBeNull(); });
  it('numeric string', () => expect(parseNumber('7.5')).toBe(7.5));
  it('number', () => expect(parseNumber(3)).toBe(3));
  it('text is invalid', () => expect(parseNumber('abc')).toBe('invalid'));
  it('NaN is invalid', () => expect(parseNumber(NaN)).toBe('invalid'));
  it('Infinity is invalid', () => expect(parseNumber(Infinity)).toBe('invalid'));
});
describe('isValidDate', () => {
  it('accepts real date', () => expect(isValidDate('2026-11-02')).toBe(true));
  it('rejects month 13', () => expect(isValidDate('2026-13-45')).toBe(false));
  it('rejects Feb 30', () => expect(isValidDate('2026-02-30')).toBe(false));
  it('rejects text', () => expect(isValidDate('abc')).toBe(false));
  it('rejects non-string', () => expect(isValidDate(20261102)).toBe(false));
});
describe('roles', () => {
  it('canWrite', () => {
    expect(canWrite('Operator')).toBe(true);
    expect(canWrite('Admin')).toBe(true);
    expect(canWrite('Auditor')).toBe(false);
    expect(canWrite('Manager')).toBe(false);
  });
  it('isAdmin', () => { expect(isAdmin('Admin')).toBe(true); expect(isAdmin('Operator')).toBe(false); });
});
