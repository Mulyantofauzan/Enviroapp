import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES, type Role } from '@evo/shared';
import { api, patch, post } from '../api/client';
import { Icon } from '../icons';
import { useToast } from '../components/Toast';
import { Badge, type Tone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Toggle } from '../ui/Toggle';

type U = { id: string; name: string; email: string; role: Role; is_active: boolean };
const TONE: Record<Role, Tone> = { Admin: 'primary', Manager: 'water', Operator: 'warning', Auditor: 'purple' };
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

const MATRIX: { fn: string; role: Role }[] = [
  { fn: 'Akun dan master data', role: 'Admin' },
  { fn: 'Atur jadwal kalender', role: 'Manager' },
  { fn: 'Dashboard dan laporan', role: 'Manager' },
  { fn: 'Input data dan eksekusi event', role: 'Operator' },
  { fn: 'Lihat kalender dan historis', role: 'Auditor' },
  { fn: 'Unduh eviden lapangan', role: 'Auditor' },
];

function Matrix() {
  return (
    <section className="ui-card">
      <h2>Hak akses peran</h2>
      <p className="ui-muted">Fungsi utama setiap peran dalam EVO</p>
      <table className="ui-matrix" aria-label="Hak akses peran">
        <thead><tr><th scope="col">Fungsi</th><th scope="col">Admin</th><th scope="col">Mgr</th><th scope="col">Opr</th><th scope="col">Aud</th></tr></thead>
        <tbody>
          {MATRIX.map((m) => (
            <tr key={m.fn}>
              <td>{m.fn}</td>
              {(['Admin', 'Manager', 'Operator', 'Auditor'] as Role[]).map((r) => (
                <td key={r}>{r === 'Admin' || r === m.role ? <span className="ui-tick"><Icon name="check" size={16} label="Ya" /></span> : <span role="img" aria-label="Tidak">-</span>}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ui-muted">Tanda strip berarti bukan fungsi utama peran tersebut. Admin punya akses penuh.</p>
    </section>
  );
}

export function Pengguna() {
  const nav = useNavigate();
  const toast = useToast();
  const [users, setUsers] = useState<U[] | null>(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'Semua' | Role>('Semua');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Operator' as Role });

  const load = () => api<U[]>('/users').then(setUsers).catch((e) => toast(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (users ?? []).filter((u) => (role === 'Semua' || u.role === role) && (!t || u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)));
  }, [users, q, role]);

  const change = async (u: U, body: object, ok?: string) => {
    try { await patch(`/users/${u.id}`, body); if (ok) toast(ok); load(); } catch (e) { toast((e as Error).message); }
  };
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await post('/users', form);
      toast('Pengguna ditambahkan');
      setForm({ name: '', email: '', password: '', role: 'Operator' });
      setAdding(false);
      load();
    } catch (err) { toast((err as Error).message); }
  }
  function reset(u: U) {
    const pw = window.prompt(`Kata sandi baru untuk ${u.name} (minimal 8 karakter)`);
    if (pw) change(u, { password: pw }, 'Kata sandi diganti');
  }

  return (
    <>
      <ScreenHeader title="Kelola Pengguna" subtitle="Admin System - akun dan hak akses" onProfile={() => nav('/akun')} />
      <div className="ui-page">
        <label className="ui-search">
          <Icon name="search" />
          <input type="search" aria-label="Cari nama atau email" placeholder="Cari nama atau email" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="ui-chips" role="tablist" aria-label="Filter peran">
          {(['Semua', ...ROLES] as const).map((r) => (
            <button key={r} type="button" role="tab" aria-selected={r === role} className={r === role ? 'is-on' : ''} onClick={() => setRole(r)}>{r}</button>
          ))}
        </div>

        <section className="ui-card ui-users" aria-label="Daftar pengguna">
          <div className="ui-users__head">
            <h2>{users ? `${shown.length} pengguna` : 'Memuat…'}</h2>
            <Button onClick={() => setAdding((v) => !v)}><Icon name="plus" /> Tambah</Button>
          </div>
          {adding && (
            <form className="ui-stack ui-adduser" onSubmit={add}>
              <label className="ui-text"><span>Nama</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
              <label className="ui-text"><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
              <label className="ui-text"><span>Kata sandi</span><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></label>
              <label className="ui-text"><span>Peran</span>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              </label>
              <Button type="submit">Simpan pengguna</Button>
            </form>
          )}
          {users && shown.length === 0 && <p className="ui-muted">Tidak ada pengguna yang cocok.</p>}
          {shown.map((u) => (
            <div key={u.id} className="ui-user">
              <span className={`ui-avatar ui-avatar--${TONE[u.role]}`} aria-hidden="true">{initials(u.name)}</span>
              <div className="ui-user__main">
                <strong>{u.name}</strong>
                <small>{u.email}</small>
                <details className="ui-more">
                  <summary>Atur</summary>
                  <label className="ui-text"><span>Ubah peran</span>
                    <select aria-label={`Peran ${u.name}`} value={u.role} onChange={(e) => change(u, { role: e.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                  </label>
                  <Button variant="outline" onClick={() => reset(u)}>Atur ulang kata sandi</Button>
                </details>
              </div>
              <div className="ui-user__side">
                <Badge tone={TONE[u.role]}>{u.role}</Badge>
                <Toggle label={`Aktif: ${u.name}`} checked={u.is_active} onChange={(v) => change(u, { is_active: v })} />
              </div>
            </div>
          ))}
        </section>
        <Matrix />
      </div>
    </>
  );
}
