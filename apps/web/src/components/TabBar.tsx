import { NavLink } from 'react-router-dom';
import { isAdmin } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';

export function TabBar() {
  const { user } = useAuth();
  const tabs = [
    { to: '/', label: 'Today', end: true },
    { to: '/history', label: 'History', end: false },
    ...(user && isAdmin(user.role) ? [{ to: '/admin', label: 'Admin', end: false }] : []),
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'tab is-active' : 'tab')}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
