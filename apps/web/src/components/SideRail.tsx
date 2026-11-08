import { NavLink } from 'react-router-dom';
import type { Role } from '@evo/shared';
import { Icon } from '../icons';
import { railFor } from '../nav/nav';

export function SideRail({ role }: { role: Role }) {
  return (
    <nav className="ui-rail" aria-label="Menu utama">
      <span className="ui-rail__brand"><img src="/logo.png" width="28" height="28" alt="" />ENVIRO</span>
      {railFor(role).map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'ui-rail__item is-on' : 'ui-rail__item')}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
