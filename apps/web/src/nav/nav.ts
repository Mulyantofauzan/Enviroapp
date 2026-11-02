import type { Role } from '@evo/shared';
import type { IconName } from '../icons';

export type NavItem = { to: string; label: string; icon: IconName };

const BERANDA: NavItem = { to: '/', label: 'Beranda', icon: 'home' };
const INPUT: NavItem = { to: '/input', label: 'Input', icon: 'clipboard' };
const RIWAYAT_TAB: NavItem = { to: '/riwayat', label: 'Riwayat', icon: 'file' };
const RIWAYAT_LINK: NavItem = { to: '/riwayat', label: 'Riwayat data', icon: 'file' };
const AKUN: NavItem = { to: '/akun', label: 'Akun', icon: 'user' };
const PENGGUNA: NavItem = { to: '/pengguna', label: 'Pengguna', icon: 'users' };
const MASTER: NavItem = { to: '/master', label: 'Master', icon: 'database' };

/** Only destinations that exist today. Kalender, Laporan and Eviden are added when those parts are built. */
export function navFor(role: Role): { tabs: NavItem[]; more: NavItem[]; manage: NavItem[] } {
  switch (role) {
    case 'Auditor': return { tabs: [RIWAYAT_TAB, AKUN], more: [], manage: [] };
    case 'Manager': return { tabs: [BERANDA, AKUN], more: [RIWAYAT_LINK], manage: [] };
    case 'Operator': return { tabs: [BERANDA, INPUT, AKUN], more: [RIWAYAT_LINK], manage: [] };
    case 'Admin': return { tabs: [BERANDA, INPUT, AKUN], more: [RIWAYAT_LINK], manage: [PENGGUNA, MASTER] };
  }
}

export const homeFor = (role: Role) => (role === 'Auditor' ? '/riwayat' : '/');

/** Everything the wide-screen rail lists, Akun last. */
export function railFor(role: Role): NavItem[] {
  const n = navFor(role);
  const all = [...n.tabs.filter((t) => t.to !== '/akun'), ...n.more, ...n.manage, AKUN];
  return all.filter((x, i) => all.findIndex((y) => y.to === x.to) === i);
}
