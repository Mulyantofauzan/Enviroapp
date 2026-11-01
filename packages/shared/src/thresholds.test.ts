import { describe, it, expect } from 'vitest';
import { isOutOfLimit } from './thresholds';

describe('isOutOfLimit', () => {
  it('below min', () => expect(isOutOfLimit(5.9, { min: 6, max: 9 })).toBe(true));
  it('inside range', () => expect(isOutOfLimit(7, { min: 6, max: 9 })).toBe(false));
  it('above max with null min', () => expect(isOutOfLimit(50, { min: null, max: 40 })).toBe(true));
  it('inside with null min', () => expect(isOutOfLimit(3, { min: null, max: 40 })).toBe(false));
  it('null value is never out', () => expect(isOutOfLimit(null, { min: 6, max: 9 })).toBe(false));
  it('no threshold is never out', () => expect(isOutOfLimit(7, undefined)).toBe(false));
});
