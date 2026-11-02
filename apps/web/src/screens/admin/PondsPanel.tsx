import { useEffect, useState, type FormEvent } from 'react';
import { api, patch, post } from '../../api/client';
import { useToast } from '../../components/Toast';
import type { Pond } from '../../components/PondChips';

export function PondsPanel() {
  const toast = useToast();
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [name, setName] = useState('');
  const load = () => api<Pond[]>('/ponds?all=1').then(setPonds).catch((e) => toast(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function add(e: FormEvent) {
    e.preventDefault();
    try { await post('/ponds', { name }); setName(''); toast('Pond added'); load(); } catch (err) { toast((err as Error).message); }
  }
  async function toggle(p: Pond) {
    try { await patch(`/ponds/${p.id}`, { is_active: !p.is_active }); load(); } catch (err) { toast((err as Error).message); }
  }
  async function rename(p: Pond) {
    const next = window.prompt('New pond name', p.name);
    if (!next || next === p.name) return;
    try { await patch(`/ponds/${p.id}`, { name: next }); load(); } catch (err) { toast((err as Error).message); }
  }

  return (
    <div className="stack">
      <form onSubmit={add} className="inline-form">
        <label className="field"><span>New pond</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <button className="btn-primary">Add pond</button>
      </form>
      {ponds.map((p) => (
        <div key={p.id} className="row-card">
          <strong>{p.name}</strong>
          <span className="muted">{p.is_active ? 'Active' : 'Switched off'}</span>
          <button className="btn-secondary" onClick={() => rename(p)}>Rename</button>
          <button className="btn-secondary" onClick={() => toggle(p)}>{p.is_active ? 'Switch off' : 'Switch on'}</button>
        </div>
      ))}
    </div>
  );
}
