import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROLE_LABEL } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../icons';
import { navFor, type NavItem } from '../nav/nav';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Button } from '../ui/Button';
import { listItems } from '../lib/outbox/queue';

function Menu({ title, items }: { title: string; items: NavItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="ui-card ui-menu" aria-label={title}>
      <h2>{title}</h2>
      {items.map((i) => (
        <Link key={i.to} to={i.to}>
          <Icon name={i.icon} />
          <span>{i.label}</span>
          <Icon name="chevron-right" size={18} />
        </Link>
      ))}
    </section>
  );
}

export function Akun() {
  const { user, logout } = useAuth();
  const [waiting, setWaiting] = useState(0);
  const [asking, setAsking] = useState(false);
  if (!user) return null;
  // Read at the moment of the click, so a queue that is still loading cannot be skipped.
  async function leave() {
    const n = (await listItems(user!.id).catch(() => [])).length;
    if (n === 0) return logout();
    setWaiting(n);
    setAsking(true);
  }
  const n = navFor(user.role);
  return (
    <>
      <ScreenHeader title="Akun" subtitle="Profil dan pengaturan" />
      <div className="ui-page">
        <section className="ui-card ui-profile">
          <span className="ui-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <p>{ROLE_LABEL[user.role]}</p>
          </div>
        </section>
        <Menu title="Data" items={n.more} />
        <Menu title="Kelola" items={n.manage} />
        {asking ? (
          <section className="ui-card ui-stack" role="alertdialog" aria-label="Konfirmasi keluar">
            <p>Ada {waiting} data belum terunggah. Keluar akan menyimpannya di HP sampai Anda masuk lagi.</p>
            <Button variant="danger" block onClick={logout}>Tetap keluar</Button>
            <Button variant="outline" block onClick={() => setAsking(false)}>Batal</Button>
          </section>
        ) : (
          <Button variant="outline" block onClick={leave}><Icon name="log-out" /> Keluar</Button>
        )}
      </div>
    </>
  );
}
