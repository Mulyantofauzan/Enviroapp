import { useEffect, useState } from 'react';
import { api } from '../api/client';

export type EventSummary = { today: string; overdue: number; due_today: number };

/** A failing summary hides the event tile text; it never breaks the page. */
export function useEventSummary() {
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api<EventSummary>('/events/summary').then((s) => live && setSummary(s)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, []);
  return { summary, error };
}
