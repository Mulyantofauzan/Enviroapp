import { describe, it, expect } from 'vitest';
import { formatCoords, stampText } from './stamp';

describe('formatCoords', () => {
  it('five decimals with a dot, like the design', () => expect(formatCoords(-3.784212, 115.602139)).toBe('-3.78421, 115.60214'));
  it('keeps the sign and pads zeros', () => expect(formatCoords(0, -0.5)).toBe('0.00000, -0.50000'));
  it('never prints a negative zero', () => expect(formatCoords(-0.0000001, 0.0000001)).toBe('0.00000, 0.00000'));
});

describe('stampText', () => {
  it('coordinates and WITA time', () =>
    expect(stampText({ lat: -3.78421, lng: 115.60214 }, new Date('2026-11-02T00:21:00Z'))).toBe('GPS -3.78421, 115.60214 - 2 Nov 2026 08:21 WITA'));
  it('says so when there is no location', () =>
    expect(stampText(null, new Date('2026-11-02T16:30:00Z'))).toBe('Tanpa lokasi - 3 Nov 2026 00:30 WITA'));
  it('is still the same day at 15:59 UTC, the next day from 16:00 UTC', () => {
    expect(stampText(null, new Date('2026-12-31T15:59:00Z'))).toBe('Tanpa lokasi - 31 Des 2026 23:59 WITA');
    expect(stampText(null, new Date('2026-12-31T16:00:00Z'))).toBe('Tanpa lokasi - 1 Jan 2027 00:00 WITA');
  });
  it('month names carry no stray dots', () => expect(stampText(null, new Date('2026-08-05T03:05:00Z'))).toBe('Tanpa lokasi - 5 Agu 2026 11:05 WITA'));
});
