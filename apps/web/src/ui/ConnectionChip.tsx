import { useEffect, useState } from 'react';
import { Icon } from '../icons';

export function ConnectionChip() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online) return null;
  return (
    <span className="ui-badge ui-badge--warning ui-conn" role="status">
      <Icon name="cloud-off" size={16} /> Tidak ada koneksi
    </span>
  );
}
