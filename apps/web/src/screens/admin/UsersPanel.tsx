import { useEffect, useState, type FormEvent } from 'react';
import { ROLES, type Role } from '@evo/shared';
import { api, patch, post } from '../../api/client';
import { useToast } from '../../components/Toast';

type U = { id: string; name: string; email: string; role: Role };

export function UsersPanel() {
  const toast = useToast();
  const [users, setUsers] = useState<U[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Operator' as Role });
  const load = () => api<U[]>('/users').then(setUsers).catch((e) => toast(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function add(e: FormEvent) {
    e.preventDefault();
    try { await post('/users', form); setForm({ ...form, name: '', email: '', password: '' }); toast('User added'); load(); } catch (err) { toast((err as Error).message); }
  }
  async function setRole(u: U, role: Role) {
    try { await patch(`/users/${u.id}`, { role }); load(); } catch (err) { toast((err as Error).message); }
  }
  async function reset(u: U) {
    const pw = window.prompt(`New password for ${u.name} (8+ characters)`);
    if (!pw) return;
    try { await patch(`/users/${u.id}`, { password: pw }); toast('Password changed'); } catch (err) { toast((err as Error).message); }
  }

  return (
    <div className="stack">
      <form onSubmit={add} className="stack">
        <label className="field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label className="field"><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label className="field"><span>Password</span><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        <label className="field"><span>Role</span>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <button className="btn-primary">Add user</button>
      </form>
      {users.map((u) => (
        <div key={u.id} className="row-card">
          <div><strong>{u.name}</strong><br /><span className="muted">{u.email}</span></div>
          <select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => setRole(u, e.target.value as Role)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          <button className="btn-secondary" onClick={() => reset(u)}>Reset password</button>
        </div>
      ))}
    </div>
  );
}
