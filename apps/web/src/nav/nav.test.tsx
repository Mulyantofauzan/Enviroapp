import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@evo/shared';
import { navFor, homeFor } from './nav';
import { AuthProvider } from '../auth/AuthContext';
import { ToastProvider } from '../components/Toast';
import { App } from '../App';
import { PondProvider, usePond } from '../pond/PondContext';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); try { localStorage.clear(); } catch { /* ignore */ } });

const labels = (r: Role) => navFor(r).tabs.map((t) => t.label);

describe('navFor', () => {
  it('tabs per role', () => {
    expect(labels('Operator')).toEqual(['Beranda', 'Input', 'Kalender', 'Akun']);
    expect(labels('Manager')).toEqual(['Beranda', 'Kalender', 'Akun']);
    expect(labels('Auditor')).toEqual(['Kalender', 'Riwayat', 'Eviden', 'Akun']);
    expect(labels('Admin')).toEqual(['Beranda', 'Input', 'Kalender', 'Akun']);
  });
  it('admin manages users and master data, others do not', () => {
    expect(navFor('Admin').manage.map((m) => m.label)).toEqual(['Atur jadwal', 'Pengguna', 'Master']);
    expect(navFor('Manager').manage.map((m) => m.label)).toEqual(['Atur jadwal']);
    expect(navFor('Operator').manage).toEqual([]);
  });
  it('riwayat link lives in Akun except for the auditor, who has the tab', () => {
    expect(navFor('Operator').more.map((m) => m.label)).toEqual(['Riwayat data', 'Eviden lapangan']);
    expect(navFor('Auditor').more).toEqual([]);
  });
  it('field evidence is a tab for the auditor and a link in Akun for everyone else', () => {
    expect(navFor('Auditor').more).toEqual([]);
    for (const r of ['Operator', 'Manager', 'Admin'] as Role[]) expect(navFor(r).more.map((m) => m.label)).toContain('Eviden lapangan');
  });
  it('home', () => {
    expect(homeFor('Auditor')).toBe('/kalender');
    expect(homeFor('Manager')).toBe('/');
  });
});

function mock(role: Role, ponds: unknown[] = [{ id: 'p1', code: 'SP-02', name: 'Pit Selatan', latitude: null, longitude: null, is_active: true, thresholds: {} }]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/auth/me')) return new Response(JSON.stringify({ id: 'u1', name: 'Rudi Hartono', role }));
    if (url.startsWith('/api/ponds')) return new Response(JSON.stringify(ponds));
    return new Response(JSON.stringify({}), { status: 200 });
  }));
}
const open = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider></MemoryRouter>);

describe('App routing', () => {
  it('manager opening /input lands on the dashboard', async () => {
    mock('Manager');
    open('/input');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
  it('operator opening /master lands on home', async () => {
    mock('Operator');
    open('/master');
    expect(await screen.findByRole('heading', { name: /Halo, Rudi/ })).toBeInTheDocument();
  });
  it('auditor opening / lands on the calendar', async () => {
    mock('Auditor');
    open('/');
    expect(await screen.findByRole('heading', { name: 'Kalender' })).toBeInTheDocument();
  });
  it('tab bar shows only the role tabs', async () => {
    mock('Operator');
    open('/');
    const nav = await screen.findByRole('navigation', { name: 'Menu utama' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Beranda', 'Input', 'Kalender', 'Akun']);
  });
});

describe('Akun', () => {
  it('operator sees name, role label, riwayat link and Keluar', async () => {
    mock('Operator');
    open('/akun');
    expect(await screen.findByText('Rudi Hartono')).toBeInTheDocument();
    expect(screen.getByText('Operator Lapangan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Riwayat data/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keluar' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pengguna/ })).toBeNull();
  });
  it('admin sees Pengguna and Master', async () => {
    mock('Admin');
    open('/akun');
    expect(await screen.findByRole('link', { name: /Pengguna/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Master/ })).toBeInTheDocument();
  });
  it('manager sees Atur jadwal, operator does not', async () => {
    mock('Manager');
    open('/akun');
    expect(await screen.findByRole('link', { name: /Atur jadwal/ })).toHaveAttribute('href', '/kalender/jadwal');
  });
  it('operator has no Atur jadwal', async () => {
    mock('Operator');
    open('/akun');
    await screen.findByText('Rudi Hartono');
    expect(screen.queryByRole('link', { name: /Atur jadwal/ })).toBeNull();
  });
  it('operator opening /kalender/jadwal is sent home', async () => {
    mock('Operator');
    open('/kalender/jadwal');
    expect(await screen.findByRole('heading', { name: /Halo, Rudi/ })).toBeInTheDocument();
  });
  it('auditor has no riwayat link in Akun', async () => {
    mock('Auditor');
    open('/akun');
    await screen.findByText('Rudi Hartono');
    expect(screen.queryByRole('link', { name: /Riwayat data/ })).toBeNull();
  });
});

function Probe() {
  const { current, loading } = usePond();
  return <p>{loading ? 'memuat' : `pond:${current}`}</p>;
}
const ponds2 = [
  { id: 'a', code: null, name: 'SP 1', is_active: true },
  { id: 'b', code: null, name: 'SP 2', is_active: true },
];

describe('PondProvider', () => {
  it('falls back to the first active pond when the stored one is gone', async () => {
    mock('Operator', ponds2);
    localStorage.setItem('evo.sp', 'gone');
    render(<PondProvider><Probe /></PondProvider>);
    expect(await screen.findByText('pond:a')).toBeInTheDocument();
  });
  it('uses the stored pond when it still exists', async () => {
    mock('Operator', ponds2);
    localStorage.setItem('evo.sp', 'b');
    render(<PondProvider><Probe /></PondProvider>);
    expect(await screen.findByText('pond:b')).toBeInTheDocument();
  });
  it('does not crash when storage throws', async () => {
    mock('Operator', ponds2);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<PondProvider><Probe /></PondProvider>);
    expect(await screen.findByText('pond:a')).toBeInTheDocument();
  });
});
