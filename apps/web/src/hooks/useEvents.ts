import { useEffect, useState } from 'react';
import type { EventFrequency, EventOccurrence } from '@evo/shared';
import { api } from '../api/client';

type Freq = EventFrequency | '';

export function useRangeEvents(from: string | null, to: string | null, frequency: Freq) {
  const [data, setData] = useState<EventOccurrence[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!from || !to) return;
    let live = true;
    setData(null);
    setError('');
    api<{ today: string; events: EventOccurrence[] }>(`/events?from=${from}&to=${to}${frequency ? `&frequency=${frequency}` : ''}`)
      .then((r) => live && setData(r.events ?? []))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [from, to, frequency]);
  return { data, error };
}

export function useOverdue(frequency: Freq) {
  const [data, setData] = useState<{ total: number; events: EventOccurrence[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    api<{ total: number; events: EventOccurrence[] }>(`/events/overdue${frequency ? `?frequency=${frequency}` : ''}`)
      .then((r) => live && setData(r))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [frequency]);
  return { data, error };
}

/** Kept for older imports. */
export const useWeekEvents = useRangeEvents;
