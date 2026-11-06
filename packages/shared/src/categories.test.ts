import { describe, it, expect } from 'vitest';
import { CATEGORY_PALETTE, NO_CATEGORY_COLOR, nextPaletteColor } from './categories';

describe('palette', () => {
  it('has 16 unique #RRGGBB colors', () => {
    expect(CATEGORY_PALETTE).toHaveLength(16);
    expect(new Set(CATEGORY_PALETTE).size).toBe(16);
    for (const c of CATEGORY_PALETTE) expect(c).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('uncategorised is grey', () => expect(NO_CATEGORY_COLOR).toBe('#9AA39A'));
});

describe('nextPaletteColor', () => {
  const P = CATEGORY_PALETTE;
  it('starts with the first color', () => expect(nextPaletteColor([])).toBe(P[0]));
  it('takes the first color not yet used', () => expect(nextPaletteColor([P[0], P[1]])).toBe(P[2]));
  it('skips a gap, not just the end', () => expect(nextPaletteColor([P[1]])).toBe(P[0]));
  it('when all are used, takes the least used, first on a tie', () => {
    expect(nextPaletteColor([...P])).toBe(P[0]);
    expect(nextPaletteColor([...P, ...P.slice(0, 3)])).toBe(P[3]);
  });
});
