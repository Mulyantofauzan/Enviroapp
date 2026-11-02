import { useEffect, useState } from 'react';
import { OutboxSheet } from '../components/OutboxSheet';
import { useOutbox } from '../hooks/useOutbox';
import { Icon } from '../icons';

/** Connection and upload status: hidden while online with nothing waiting. */
export function SyncChip() {
  const { pending, failed } = useOutbox();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (online && pending === 0 && failed === 0) return null;
  const status = !online ? (pending > 0 ? `Tidak ada koneksi - ${pending} menunggu` : 'Tidak ada koneksi') : `Mengunggah ${pending}…`;
  const queued = pending > 0;
  return (
    <>
      {queued && (
        <button type="button" className="ui-badge ui-badge--warning ui-sync" onClick={() => setOpen(true)}>
          <Icon name="cloud-off" size={16} /> {status}
        </button>
      )}
      {!queued && failed === 0 && (
        <span className="ui-badge ui-badge--warning ui-conn" role="status"><Icon name="cloud-off" size={16} /> {status}</span>
      )}
      {failed > 0 && (
        <button type="button" className="ui-badge ui-badge--danger ui-sync" onClick={() => setOpen(true)}>{failed} gagal</button>
      )}
      {open && <OutboxSheet onClose={() => setOpen(false)} />}
    </>
  );
}
