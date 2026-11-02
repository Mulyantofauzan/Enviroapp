import type { Role } from '@evo/shared';
import type { IconName } from '../icons';

export type NavItem = { to: string; label: string; icon: IconName };

const BERANDA: NavItem = { to: '/', label: 'Beranda', icon: 'home' };
const INPUT: NavItem = { to: '/input', label: 'Input', icon: 'clipboard' };
const RIWAYAT_TAB: NavItem = { to: '/riwayat', label: 'Riwayat', icon: 'file' };
const RIWAYAT_LINK: NavItem = { to: '/riwayat', label: 'Riwayat data', icon: 'file' };
const EVIDEN_TAB: NavItem = { to: '/eviden', label: 'Eviden', icon: 'camera' };
const EVIDEN_LINK: NavItem = { to: '/eviden', label: 'Eviden lapangan', icon: 'camera' };
const LAPORAN: NavItem = { to: '/laporan', label: 'Laporan', icon: 'chart' };
const AKUN: NavItem = { to: '/akun', label: 'Akun', icon: 'user' };
const PENGGUNA: NavItem = { to: '/pengguna', label: 'Pengguna', icon: 'users' };
const MASTER: NavItem = { to: '/master', label: 'Master', icon: 'database' };
const KALENDER: NavItem = { to: '/kalender', label: 'Kalender', icon: 'calendar' };
const JADWAL: NavItem = { to: '/kalender/jadwal', label: 'Atur jadwal', icon: 'clipboard' };

/** Only destinations that exist today. Operators have no Laporan: they read their own data in Riwayat. */
export function navFor(role: Role): { tabs: NavItem[]; more: NavItem[]; manage: NavItem[] } {
  switch (role) {
    case 'Auditor': return { tabs: [KALENDER, RIWAYAT_TAB, EVIDEN_TAB, LAPORAN, AKUN], more: [], manage: [] };
    case 'Manager': return { tabs: [BERANDA, KALENDER, LAPORAN, AKUN], more: [RIWAYAT_LINK, EVIDEN_LINK], manage: [JADWAL] };
    case 'Operator': return { tabs: [BERANDA, INPUT, KALENDER, AKUN], more: [RIWAYAT_LINK, EVIDEN_LINK], manage: [] };
    case 'Admin': return { tabs: [BERANDA, INPUT, KALENDER, AKUN], more: [RIWAYAT_LINK, EVIDEN_LINK, LAPORAN], manage: [JADWAL, PENGGUNA, MASTER] };
  }
}

export const homeFor = (role: Role) => (role === 'Auditor' ? '/kalender' : '/');

/** Everything the wide-screen rail lists, Akun last. */
export function railFor(role: Role): NavItem[] {
  const n = navFor(role);
  const all = [...n.tabs.filter((t) => t.to !== '/akun'), ...n.more, ...n.manage, AKUN];
  return all.filter((x, i) => all.findIndex((y) => y.to === x.to) === i);
}
