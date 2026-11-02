import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useOutbox } from '../hooks/useOutbox';
import { removeItem, retryItem } from '../lib/outbox/queue';
import { runSync } from '../lib/outbox/sync';
import { Button } from '../ui/Button';

/** Everything still on this phone waiting to be uploaded, with a way to retry or discard each item. */
export function OutboxSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { items } = useOutbox();
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function retry(id: string) {
    await retryItem(id);
    if (user) void runSync(user.id).catch(() => {});
  }

  return (
    <div className="ui-outbox" role="dialog" aria-modal="true" aria-label="Antrean unggah">
      <div className="ui-outbox__panel">
        <div className="ui-outbox__head">
          <h2>Menunggu unggah ({items.length})</h2>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </div>
        {items.length === 0 && <p className="ui-muted">Semua data sudah terunggah.</p>}
        <ul className="ui-outbox__list">
          {items.map((i) => (
            <li key={i.id}>
              <div>
                <strong>{i.label}</strong>
                <small>{i.status === 'failed' ? `Gagal: ${i.error ?? 'ditolak server'}` : i.tries > 0 ? 'Menunggu, akan dicoba lagi' : 'Menunggu sinyal'}</small>
              </div>
              {confirming === i.id ? (
                <div className="ui-outbox__confirm">
                  <p>Buang &quot;{i.label}&quot;? Data ini akan hilang dan tidak terunggah.</p>
                  <Button variant="danger" onClick={async () => { await removeItem(i.id); setConfirming(null); }}>Ya, buang</Button>
                  <Button variant="outline" onClick={() => setConfirming(null)}>Batal</Button>
                </div>
              ) : (
                <div className="ui-outbox__actions">
                  <Button variant="outline" onClick={() => retry(i.id)}>Coba lagi</Button>
                  <Button variant="outline" onClick={() => setConfirming(i.id)}>Buang</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
