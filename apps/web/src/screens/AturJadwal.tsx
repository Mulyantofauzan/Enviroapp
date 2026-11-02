import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EVENT_FREQUENCIES, FREQUENCY_LABEL, type EventFrequency } from '@evo/shared';
import { api, patch, post } from '../api/client';
import { useToast } from '../components/Toast';
import { useEventSummary } from '../hooks/useEventSummary';
import { Icon } from '../icons';
import { dayMonth } from '../lib/dates';
import type { Pond } from '../pond/PondContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ScreenHeader } from '../ui/ScreenHeader';
import { pondLabel } from '../ui/PondPicker';
import { localToday } from './input/DayScope';

type Schedule = {
  id: string; title: string; description: string | null; frequency: EventFrequency; start_date: string; sp_id: string | null;
  assigned_to: string | null; assigned_to_name: string | null; ended_on: string | null; locked: boolean;
};
type Form = { id: string | null; title: string; description: string; frequency: EventFrequency; start_date: string; sp_id: string; assigned_to: string; locked: boolean };

export function AturJadwal() {
  const nav = useNavigate();
  const toast = useToast();
  const { summary, error: summaryError } = useEventSummary();
  const today = summary?.today ?? (summaryError ? localToday() : null);
  const [list, setList] = useState<Schedule[] | null>(null);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api<Schedule[]>('/schedules?all=1').then(setList).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api<Pond[]>('/ponds?all=1').then(setPonds).catch(() => {});
    api<{ id: string; name: string }[]>('/schedules/assignees').then(setPeople).catch(() => {});
  }, []);

  const pondName = (id: string | null) => (id ? ponds.find((p) => p.id === id) : undefined);
  const openNew = () => today && setForm({ id: null, title: '', description: '', frequency: 'Daily', start_date: today, sp_id: '', assigned_to: '', locked: false });
  const openEdit = (s: Schedule) => setForm({ id: s.id, title: s.title, description: s.description ?? '', frequency: s.frequency, start_date: s.start_date, sp_id: s.sp_id ?? '', assigned_to: s.assigned_to ?? '', locked: s.locked });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const body: Record<string, unknown> = {
      title: form.title, description: form.description.trim() || null, sp_id: form.sp_id || null, assigned_to: form.assigned_to || null,
      ...(form.locked ? {} : { frequency: form.frequency, start_date: form.start_date }),
    };
    try {
      if (form.id) await patch(`/schedules/${form.id}`, body); else await post('/schedules', body);
      toast('Jadwal tersimpan');
      setForm(null);
      load();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function stop(id: string) {
    setBusy(true);
    try { await post(`/schedules/${id}/stop`, {}); toast('Jadwal dihentikan'); setConfirm(null); load(); } catch (err) { toast((err as Error).message); } finally { setBusy(false); }
  }
  const set = (patchF: Partial<Form>) => setForm((f) => (f ? { ...f, ...patchF } : f));

  return (
    <>
      <ScreenHeader title="Atur Jadwal" subtitle="Kalender Enviro Events" onProfile={() => nav('/akun')} />
      <div className="ui-page">
        <Link to="/kalender" className="ui-back"><Icon name="chevron-left" /> Kembali ke Kalender</Link>
        <Button block onClick={openNew} disabled={!today}><Icon name="plus" /> Tambah jadwal</Button>
        {error && <p className="ui-error" role="alert">{error}</p>}

        {form && (
          <form className="ui-card ui-module" onSubmit={save} aria-label={form.id ? 'Ubah jadwal' : 'Tambah jadwal'}>
            <h2>{form.id ? 'Ubah jadwal' : 'Tambah jadwal'}</h2>
            <label className="ui-text"><span>Judul</span><input value={form.title} maxLength={120} required onChange={(e) => set({ title: e.target.value })} /></label>
            <label className="ui-text"><span>Deskripsi</span><textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} /></label>
            <label className="ui-text"><span>Frekuensi</span>
              <select value={form.frequency} disabled={form.locked} onChange={(e) => set({ frequency: e.target.value as EventFrequency })}>
                {EVENT_FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
              </select>
            </label>
            <label className="ui-text"><span>Tanggal mulai</span><input type="date" value={form.start_date} disabled={form.locked} required onChange={(e) => e.target.value && set({ start_date: e.target.value })} /></label>
            {form.locked && <p className="ui-muted">Terkunci karena sudah ada catatan</p>}
            <label className="ui-text"><span>Settling Pond</span>
              <select value={form.sp_id} onChange={(e) => set({ sp_id: e.target.value })}>
                <option value="">Semua lokasi</option>
                {ponds.map((p) => <option key={p.id} value={p.id}>{pondLabel(p)}</option>)}
              </select>
            </label>
            {people.length > 0 && (
              <label className="ui-text"><span>Ditugaskan ke</span>
                <select value={form.assigned_to} onChange={(e) => set({ assigned_to: e.target.value })}>
                  <option value="">Tidak ada</option>
                  {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
            )}
            <div className="ui-two">
              <Button variant="outline" onClick={() => setForm(null)}>Batal</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan jadwal'}</Button>
            </div>
          </form>
        )}

        {!list && !error && <p className="ui-muted">Memuat…</p>}
        {list?.length === 0 && <p className="ui-muted">Belum ada jadwal. Tambahkan yang pertama.</p>}
        {list?.map((s) => {
          const p = pondName(s.sp_id);
          return (
            <article key={s.id} className="ui-card ui-sched" aria-label={s.title}>
              <div className="ui-ev__head">
                <strong>{s.title}</strong>
                <Badge tone={s.ended_on ? 'neutral' : 'success'}>{s.ended_on ? 'Berhenti' : 'Aktif'}</Badge>
              </div>
              <p className="ui-ev__meta">{FREQUENCY_LABEL[s.frequency]} - {p ? pondLabel(p) : 'Semua lokasi'} - mulai {dayMonth(s.start_date)}{s.assigned_to_name ? ` - ${s.assigned_to_name}` : ''}</p>
              {confirm === s.id ? (
                <div className="ui-stack">
                  <p><strong>Hentikan jadwal ini?</strong> Event setelah hari ini tidak akan muncul. Yang sudah lewat tetap tampil.</p>
                  <div className="ui-two">
                    <Button variant="outline" onClick={() => setConfirm(null)}>Batal</Button>
                    <Button variant="danger" disabled={busy} onClick={() => stop(s.id)}>Ya, hentikan</Button>
                  </div>
                </div>
              ) : (
                <div className="ui-sched__actions">
                  <button type="button" className="ui-iconbtn" aria-label={`Ubah ${s.title}`} onClick={() => openEdit(s)}><Icon name="pencil" /></button>
                  {!s.ended_on && <Button variant="outline" aria-label={`Hentikan ${s.title}`} onClick={() => setConfirm(s.id)}>Hentikan</Button>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
