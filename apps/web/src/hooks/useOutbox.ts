import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { outboxAvailable, type OutboxItem } from '../lib/outbox/db';
import { listItems, subscribe } from '../lib/outbox/queue';

/** The signed-in user's queued items, kept current as the queue changes. */
export function useOutbox() {
  const { user } = useAuth();
  const owner = user?.id ?? null;
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!owner || !outboxAvailable()) { setItems([]); setReady(true); return; }
    let live = true;
    const load = () => { listItems(owner).then((x) => { if (live) { setItems(x); setReady(true); } }).catch(() => { if (live) setReady(true); }); };
    load();
    const off = subscribe(load);
    return () => { live = false; off(); };
  }, [owner]);

  return { ready, items, pending: items.filter((i) => i.status === 'pending').length, failed: items.filter((i) => i.status === 'failed').length };
}
