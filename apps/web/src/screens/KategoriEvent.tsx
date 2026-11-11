import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORY_PALETTE, nextPaletteColor } from '@evo/shared';
import { api, patch, post } from '../api/client';
import { useToast } from '../components/Toast';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ScreenHeader } from '../ui/ScreenHeader';

type Category = { id: string; name: string; color: string; is_active: boolean; event_count: number };
type Form = { id: string | null; name: string; color: string };

const dot = (color: string) => ({ '--bg': color }) as React.CSSProperties;

export function KategoriEvent() {
  const nav = useNavigate();
  const toast = useToast();
  const [list, setList] = useState<Category[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<Category[]>('/event-categories').then(setList).catch((e) => toast(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => setForm({ id: null, name: '', color: nextPaletteColor((list ?? []).filter((c) => c.is_active).map((c) => c.color)) });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const body = { name: form.name, color: form.color };
      if (form.id) await patch(`/event-categories/${form.id}`, body); else await post('/event-categories', body);
      toast('Kategori tersimpan');
      setForm(null);
      load();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: Category) {
    try {
      await patch(`/event-categories/${c.id}`, { is_active: !c.is_active });
      load();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <>
      <ScreenHeader title="Kategori Event" subtitle="Kalender EVOS Events" onProfile={() => nav('/akun')} />
      <div className="ui-page ui-page--mid">
        <Link to="/kalender/jadwal" className="ui-back"><Icon name="chevron-left" /> Kembali ke Atur Jadwal</Link>
        <Button block onClick={openNew} disabled={!list}><Icon name="plus" /> Tambah kategori</Button>

        {form && (
          <form className="ui-card ui-module" onSubmit={save} aria-label={form.id ? 'Ubah kategori' : 'Tambah kategori'}>
            <h2>{form.id ? 'Ubah kategori' : 'Tambah kategori'}</h2>
            <label className="ui-text"><span>Nama</span><input value={form.name} maxLength={60} required onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <div className="ui-swatches" role="group" aria-label="Warna">
              {CATEGORY_PALETTE.map((c) => (
                <button key={c} type="button" className="ui-swatch" style={dot(c)} aria-label={`Warna ${c}`} aria-pressed={form.color === c} onClick={() => setForm({ ...form, color: c })} />
              ))}
            </div>
            <div className="ui-two">
              <Button variant="outline" onClick={() => setForm(null)}>Batal</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
            </div>
          </form>
        )}

        {!list && <p className="ui-muted">Memuat…</p>}
        {list?.length === 0 && <p className="ui-muted">Belum ada kategori. Tambahkan yang pertama, atau impor dari Excel.</p>}
        {list?.map((c) => (
          <article key={c.id} className="ui-card ui-sched" aria-label={c.name}>
            <div className="ui-ev__head">
              <strong className="ui-catname"><i className="ui-dot ui-dot--lg" style={dot(c.color)} />{c.name}</strong>
              <Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
            </div>
            <p className="ui-ev__meta">{c.event_count} event aktif</p>
            <div className="ui-sched__actions">
              <button type="button" className="ui-iconbtn" aria-label={`Ubah ${c.name}`} onClick={() => setForm({ id: c.id, name: c.name, color: c.color })}><Icon name="pencil" /></button>
              <Button variant="outline" aria-label={`${c.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${c.name}`} onClick={() => toggle(c)}>{c.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
