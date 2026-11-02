import { Link } from 'react-router-dom';
import { ROLE_LABEL } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../icons';
import { navFor, type NavItem } from '../nav/nav';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Button } from '../ui/Button';

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
  if (!user) return null;
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
        <Button variant="outline" block onClick={logout}><Icon name="log-out" /> Keluar</Button>
      </div>
    </>
  );
}
