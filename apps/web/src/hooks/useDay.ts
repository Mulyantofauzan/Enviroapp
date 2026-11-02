import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CoagulantType } from '@evo/shared';
import { api } from '../api/client';
import { applyPending } from '../lib/outbox/overlay';
import { useOutbox } from './useOutbox';

export type DayData = {
  weather: { rainfall_mm: number | null; rain_hours: number | null } | null;
  water: {
    ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null;
    debit_inlet_m3s: number | null; debit_outlet_m3s: number | null;
  } | null;
  coagulant: Record<CoagulantType, { stock_in: number | null; stock_out: number | null; stock_remaining: number | null } | null>;
  previousRemaining: Record<CoagulantType, number | null>;
};

export function useDay(date: string, sp: string | null) {
  const [data, setData] = useState<DayData | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [version, setVersion] = useState(0);
  const { items, ready } = useOutbox();

  useEffect(() => {
    if (!sp) return;
    let live = true;
    setData(null);
    setError('');
    api<DayData>(`/day?date=${date}&sp=${sp}`)
      .then((d) => { if (live) { setData(d); setVersion((v) => v + 1); } })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [date, sp, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  // Once the queue has been uploaded, show what the server now holds.
  useEffect(() => {
    window.addEventListener('outbox:drained', reload);
    return () => window.removeEventListener('outbox:drained', reload);
  }, [reload]);
  // The form takes its starting values from `data`, so it waits until the queue has been read.
  const shown = useMemo(() => (data && sp && ready ? applyPending(data, items, date, sp) : null), [data, items, date, sp, ready]);
  return { data: shown, error, reload, version };
}
