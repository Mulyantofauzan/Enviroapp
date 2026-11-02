import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { ViewerItem } from '../components/EvidenceViewer';

export type EvidenceRow = ViewerItem & { schedule_id: string; sp_id: string | null; gps_accuracy?: number | null };
export const PAGE = 50;

/** Evidence across events for a date range. Changing a filter starts over; "more" appends the next page. */
export function useEvidenceList(opts: { from: string | null; to: string | null; schedule: string; sp: string | null; ready: boolean }) {
  const { from, to, schedule, sp, ready } = opts;
  const [items, setItems] = useState<EvidenceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const gen = useRef(0);
  const busy = useRef(false);

  const query = useCallback((offset: number) => {
    const q = new URLSearchParams({ from: from!, to: to!, limit: String(PAGE), offset: String(offset) });
    if (schedule) q.set('schedule', schedule);
    if (sp) q.set('sp', sp);
    return api<{ total: number; items: EvidenceRow[] }>(`/evidence?${q}`);
  }, [from, to, schedule, sp]);

  useEffect(() => {
    if (!ready || !from || !to) return;
    let live = true;
    gen.current++;
    busy.current = false;
    setLoadingMore(false);
    setLoading(true);
    setError('');
    setItems([]);
    query(0).then((r) => { if (live) { setItems(r.items); setTotal(r.total); } })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [ready, from, to, query]);

  const more = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoadingMore(true);
    const mine = gen.current;
    setError('');
    try {
      const r = await query(items.length);
      if (mine !== gen.current) return;
      setItems((cur) => {
        const have = new Set(cur.map((x) => x.id));
        return [...cur, ...r.items.filter((x) => !have.has(x.id))];
      });
      setTotal(r.total);
    } catch (e) {
      if (mine === gen.current) setError((e as Error).message);
    } finally {
      if (mine === gen.current) { busy.current = false; setLoadingMore(false); }
    }
  }, [query, items.length]);

  return { items, total, loading, loadingMore, error, more };
}
