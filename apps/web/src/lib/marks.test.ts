import { describe, it, expect } from 'vitest';
import type { EventOccurrence } from '@evo/shared';
import { marksOf } from './marks';

const e = (due_date: string, cat?: [string, string, string]) =>
  ({ due_date, category_id: cat?.[0] ?? null, category_name: cat?.[1] ?? null, category_color: cat?.[2] ?? null }) as EventOccurrence;
const AIR: [string, string, string] = ['k1', 'Air', '#2E7D32'];
const UDARA: [string, string, string] = ['k2', 'Udara', '#1565C0'];

describe('marksOf', () => {
  it('shows each category once per day, however many events it has', () => {
    const m = marksOf([e('2026-11-02', AIR), e('2026-11-02', AIR), e('2026-11-02', AIR)]);
    expect(m['2026-11-02']).toEqual([{ key: 'k1', name: 'Air', color: '#2E7D32' }]);
  });
  it('orders categories by name', () => {
    const m = marksOf([e('2026-11-02', UDARA), e('2026-11-02', AIR)]);
    expect(m['2026-11-02'].map((x) => x.name)).toEqual(['Air', 'Udara']);
  });
  it('an event with no category is grey, called Tanpa kategori, and always last', () => {
    const m = marksOf([e('2026-11-02'), e('2026-11-02', UDARA)]);
    expect(m['2026-11-02']).toEqual([{ key: 'k2', name: 'Udara', color: '#1565C0' }, { key: 'none', name: 'Tanpa kategori', color: '#9AA39A' }]);
  });
  it('a day with no events has no entry', () => {
    expect(marksOf([e('2026-11-02', AIR)])['2026-11-03']).toBeUndefined();
    expect(marksOf([])).toEqual({});
  });
});
