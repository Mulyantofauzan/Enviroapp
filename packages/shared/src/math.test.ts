import { describe, it, expect } from 'vitest';
import { m3sToM3d, defaultRemaining, m3sToLs, lsToM3s, isNoFlow } from './math';

describe('m3sToM3d', () => {
  it('converts 1 m3/s to 86400 m3/d', () => expect(m3sToM3d(1)).toBe(86400));
  it('converts 0.5 m3/s to 43200 m3/d', () => expect(m3sToM3d(0.5)).toBe(43200));
});
describe('defaultRemaining', () => {
  it('no previous: in minus out', () => expect(defaultRemaining(null, 10, 3)).toBe(7));
  it('adds to previous', () => expect(defaultRemaining(5, 10, 3)).toBe(12));
  it('can go negative', () => expect(defaultRemaining(2, 0, 5)).toBe(-3));
});

describe('debit units', () => {
  it('converts m3/s to L/s', () => expect(m3sToLs(0.25)).toBe(250));
  it('converts L/s to m3/s', () => expect(lsToM3s(250)).toBe(0.25));
  it('round-trips without a floating tail', () => {
    expect(lsToM3s(m3sToLs(0.123))).toBe(0.123);
    expect(m3sToLs(lsToM3s(123))).toBe(123);
  });
});
describe('isNoFlow', () => {
  it('is true only for exactly zero', () => {
    expect(isNoFlow(0)).toBe(true);
    expect(isNoFlow(0.0001)).toBe(false);
  });
  it('is false when there is no value', () => {
    expect(isNoFlow(null)).toBe(false);
    expect(isNoFlow(undefined)).toBe(false);
  });
});
