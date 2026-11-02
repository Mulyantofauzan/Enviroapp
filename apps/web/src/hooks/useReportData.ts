import { useEffect, useRef, useState } from 'react';
import type { EventOccurrence } from '@evo/shared';
import { api } from '../api/client';
import { addDays, dateText } from '../lib/dates';
import type { HistoryEntry, ReportKind } from '../lib/report';
import { eventWindows } from '../lib/windows';

type Opts = { from: string; to: string; sp: string; kinds: ReportKind[]; today: string | null };

/** Table data for the chosen period, one year of history for the long charts, and events window by window. */
export function useReportData({ from, to, sp, kinds, today }: Opts) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [ytd, setYtd] = useState<HistoryEntry[] | null>(null);
  const [events, setEvents] = useState<EventOccurrence[] | null>(null);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<{ history: string; ytd: string; events: string }>({ history: '', ytd: '', events: '' });
  const [pending, setPending] = useState({ history: false, ytd: false, events: false });
  const gen = useRef({ history: 0, ytd: 0, events: 0 });

  const needHistory = kinds.some((k) => k !== 'event');
  const needYear = kinds.includes('cuaca') || kinds.includes('koagulan');
  const needEvents = kinds.includes('event');
  const spQuery = sp ? `&sp=${sp}` : '';

  useEffect(() => {
    const mine = ++gen.current.history;
    setEntries(null);
    setErrors((e) => ({ ...e, history: '' }));
    if (!needHistory || !today) { setPending((p) => ({ ...p, history: false })); return; }
    setPending((p) => ({ ...p, history: true }));
    api<HistoryEntry[]>(`/history?from=${from}&to=${to}${spQuery}`)
      .then((r) => { if (mine === gen.current.history) setEntries(r); })
      .catch((e) => { if (mine === gen.current.history) setErrors((x) => ({ ...x, history: e.message })); })
      .finally(() => { if (mine === gen.current.history) setPending((p) => ({ ...p, history: false })); });
  }, [from, to, spQuery, needHistory, today]);

  useEffect(() => {
    const mine = ++gen.current.ytd;
    setYtd(null);
    setErrors((e) => ({ ...e, ytd: '' }));
    if (!needYear || !today) { setPending((p) => ({ ...p, ytd: false })); return; }
    setPending((p) => ({ ...p, ytd: true }));
    api<HistoryEntry[]>(`/history?from=${addDays(today, -365)}&to=${today}${spQuery}`)
      .then((r) => { if (mine === gen.current.ytd) setYtd(r); })
      .catch((e) => { if (mine === gen.current.ytd) setErrors((x) => ({ ...x, ytd: e.message })); })
      .finally(() => { if (mine === gen.current.ytd) setPending((p) => ({ ...p, ytd: false })); });
  }, [spQuery, needYear, today]);

  useEffect(() => {
    const mine = ++gen.current.events;
    setEvents(null);
    setProgress('');
    setErrors((e) => ({ ...e, events: '' }));
    if (!needEvents || !today) { setPending((p) => ({ ...p, events: false })); return; }
    setPending((p) => ({ ...p, events: true }));
    (async () => {
      const windows = eventWindows(from, to);
      const all: EventOccurrence[] = [];
      for (let i = 0; i < windows.length; i++) {
        const [a, b] = windows[i];
        if (mine !== gen.current.events) return;
        setProgress(`Memuat event ${i + 1} dari ${windows.length}`);
        try {
          const r = await api<{ events: EventOccurrence[] }>(`/events?from=${a}&to=${b}${spQuery}`);
          all.push(...(r.events ?? []));
        } catch (e) {
          if (mine === gen.current.events) setErrors((x) => ({ ...x, events: `Event ${dateText(a)} sampai ${dateText(b)} gagal dimuat: ${(e as Error).message}` }));
          return;
        }
      }
      if (mine === gen.current.events) setEvents(all);
    })().finally(() => { if (mine === gen.current.events) { setPending((p) => ({ ...p, events: false })); setProgress(''); } });
  }, [from, to, spQuery, needEvents, today]);

  return {
    entries, ytd, events, progress,
    loading: pending.history || pending.ytd || pending.events,
    error: errors.history || errors.events || errors.ytd,
  };
}
