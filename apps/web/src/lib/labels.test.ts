import { describe, it, expect } from 'vitest';
import { labeledIndexes, labelAnchor } from './labels';

describe('labeledIndexes', () => {
  it('labels every value up to the limit', () => {
    expect([...labeledIndexes([1, 2, 3], 14)]).toEqual([0, 1, 2]);
  });
  it('beyond the limit keeps first, last, highest and lowest only', () => {
    const v = Array.from({ length: 20 }, (_, i) => (i === 7 ? 99 : i === 3 ? -5 : 10 + (i % 3)));
    expect(labeledIndexes(v, 14)).toEqual(new Set([0, 19, 7, 3]));
  });
  it('skips nulls and does not count them', () => {
    expect([...labeledIndexes([null, 4, null, 6], 14)]).toEqual([1, 3]);
  });
  it('all null gives nothing', () => {
    expect(labeledIndexes([null, null]).size).toBe(0);
  });
  it('equal values do not duplicate indexes', () => {
    const idx = labeledIndexes(Array(20).fill(5), 14);
    expect(idx).toEqual(new Set([0, 19]));
  });
});

describe('labelAnchor', () => {
  it('keeps text inside the plot area', () => {
    expect(labelAnchor(40, 38, 328, 30)).toBe('start');
    expect(labelAnchor(325, 38, 328, 30)).toBe('end');
    expect(labelAnchor(180, 38, 328, 30)).toBe('middle');
  });
});
