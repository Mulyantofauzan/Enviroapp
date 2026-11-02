import { describe, it, expect } from 'vitest';
import type { EventOccurrence } from '@evo/shared';
import { marksOf } from './marks';

const e = (due_date: string, status: EventOccurrence['status']) => ({ due_date, status }) as EventOccurrence;

describe('marksOf', () => {
  it('overdue is red, today and upcoming are pending (yellow), done is green', () => {
    const m = marksOf([e('2026-11-01', 'overdue'), e('2026-11-02', 'today'), e('2026-11-03', 'upcoming'), e('2026-11-04', 'done')]);
    expect(m).toEqual({ '2026-11-01': ['overdue'], '2026-11-02': ['pending'], '2026-11-03': ['pending'], '2026-11-04': ['done'] });
  });
  it('several events on one day show each kind once, in the order red, yellow, green', () => {
    const m = marksOf([e('2026-11-02', 'done'), e('2026-11-02', 'upcoming'), e('2026-11-02', 'overdue'), e('2026-11-02', 'overdue'), e('2026-11-02', 'today')]);
    expect(m['2026-11-02']).toEqual(['overdue', 'pending', 'done']);
  });
  it('a day with no events has no entry', () => {
    expect(marksOf([e('2026-11-02', 'done')])['2026-11-03']).toBeUndefined();
    expect(marksOf([])).toEqual({});
  });
});
