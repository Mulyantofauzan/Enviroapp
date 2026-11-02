import { NavLink } from 'react-router-dom';
import type { Role } from '@evo/shared';
import { Icon } from '../icons';
import { navFor } from '../nav/nav';

export function TabBar({ role }: { role: Role }) {
  return (
    <nav className="ui-tabbar" aria-label="Menu utama">
      {navFor(role).tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'ui-tab is-on' : 'ui-tab')}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
