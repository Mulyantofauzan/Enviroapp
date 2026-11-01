import { describe, it, expect } from 'vitest';
import { m3sToM3d, defaultRemaining } from './math';

describe('m3sToM3d', () => {
  it('converts 1 m3/s to 86400 m3/d', () => expect(m3sToM3d(1)).toBe(86400));
  it('converts 0.5 m3/s to 43200 m3/d', () => expect(m3sToM3d(0.5)).toBe(43200));
});
describe('defaultRemaining', () => {
  it('no previous: in minus out', () => expect(defaultRemaining(null, 10, 3)).toBe(7));
  it('adds to previous', () => expect(defaultRemaining(5, 10, 3)).toBe(12));
  it('can go negative', () => expect(defaultRemaining(2, 0, 5)).toBe(-3));
});
