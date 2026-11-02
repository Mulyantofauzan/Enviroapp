import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, patch, post } from '../api/client';
import { Icon } from '../icons';
import { useToast } from '../components/Toast';
import { usePond, type Pond } from '../pond/PondContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Toggle } from '../ui/Toggle';
import { pondLabel } from '../ui/PondPicker';
import { hasInvalid } from './input/coag';

type N = number | null;
type Form = { id: string | null; code: string; name: string; lat: N; lng: N; phMin: N; phMax: N; tssMax: N; active: boolean };

const blank: Form = { id: null, code: '', name: '', lat: null, lng: null, phMin: null, phMax: null, tssMax: null, active: true };
const toForm = (p: Pond): Form => ({
  id: p.id, code: p.code ?? '', name: p.name, lat: p.latitude ?? null, lng: p.longitude ?? null,
  phMin: p.thresholds?.ph_outlet?.min ?? null, phMax: p.thresholds?.ph_outlet?.max ?? null, tssMax: p.thresholds?.tss_outlet?.max ?? null, active: p.is_active,
});

function PondForm({ initial, onDone, onCancel }: { initial: Form; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const root = useRef<HTMLFormElement>(null);
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (patchF: Partial<Form>) => setF((x) => ({ ...x, ...patchF }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hasInvalid(root.current)) return toast('Perbaiki angka yang ditandai dulu.');
    setBusy(true);
    const body = {
      code: f.code.trim() || null, name: f.name, latitude: f.lat, longitude: f.lng,
      thresholds: { ph_outlet: { min: f.phMin, max: f.phMax }, tss_outlet: { min: null, max: f.tssMax } },
    };
    try {
      if (f.id) await patch(`/ponds/${f.id}`, { ...body, is_active: f.active });
      else await post('/ponds', body);
      toast('Settling pond tersimpan');
      onDone();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={root} className="ui-card ui-module" onSubmit={submit} aria-label={f.id ? `Ubah ${f.name}` : 'Tambah Settling Pond'}>
      <h2>{f.id ? `Ubah ${pondLabel({ code: initial.code || null, name: initial.name })}` : 'Tambah Settling Pond'}</h2>
      <div className="ui-two">
        <label className="ui-text"><span>Kode</span><input value={f.code} onChange={(e) => set({ code: e.target.value })} /></label>
        <label className="ui-text"><span>Nama</span><input value={f.name} onChange={(e) => set({ name: e.target.value })} required /></label>
        <NumberInput label="Latitude" value={f.lat} onChange={(v) => set({ lat: v })} />
        <NumberInput label="Longitude" value={f.lng} onChange={(v) => set({ lng: v })} />
      </div>
      <h3>Baku mutu (untuk sorotan abnormal)</h3>
      <div className="ui-two">
        <NumberInput label="pH minimum" value={f.phMin} onChange={(v) => set({ phMin: v })} />
        <NumberInput label="pH maksimum" value={f.phMax} onChange={(v) => set({ phMax: v })} />
      </div>
      <NumberInput label="TSS maksimum (mg/L)" value={f.tssMax} onChange={(v) => set({ tssMax: v })} placeholder="[isi sesuai izin lingkungan]" />
      {f.id && (
        <div className="ui-switchrow">
          <div><strong>Settling Pond aktif</strong><small>Tampil di pilihan lokasi operator</small></div>
          <Toggle label="Settling Pond aktif" checked={f.active} onChange={(v) => set({ active: v })} />
        </div>
      )}
      <div className="ui-two">
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
      </div>
    </form>
  );
}

export function Master() {
  const nav = useNavigate();
  const toast = useToast();
  const { reload: reloadPickers } = usePond();
  const [ponds, setPonds] = useState<Pond[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);

  const load = () => api<Pond[]>('/ponds?all=1').then(setPonds).catch((e) => toast(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <ScreenHeader title="Master Data" subtitle="Admin System - Settling Pond" onProfile={() => nav('/akun')} />
      <div className="ui-page">
        <Button block onClick={() => setForm({ ...blank })}><Icon name="plus" /> Tambah Settling Pond</Button>
        <section className="ui-card ui-rows" aria-label="Daftar Settling Pond">
          <h2>{ponds ? `${ponds.length} Settling Pond` : 'Memuat…'}</h2>
          {ponds?.map((p) => (
            <div key={p.id} className={`ui-row${form?.id === p.id ? ' is-picked' : ''}`}>
              <span className={`ui-bubble ui-bubble--${p.is_active ? 'primary' : 'neutral'}`}><Icon name="droplet" /></span>
              <div className="ui-row__main">
                <strong>{pondLabel(p)}</strong>
                {p.latitude != null && p.longitude != null && <small>{p.latitude}, {p.longitude}</small>}
              </div>
              <Badge tone={p.is_active ? 'success' : 'neutral'}>{p.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
              <button type="button" className="ui-iconbtn" aria-label={`Ubah ${pondLabel(p)}`} onClick={() => setForm(toForm(p))}><Icon name="pencil" /></button>
            </div>
          ))}
          {ponds?.length === 0 && <p className="ui-muted">Belum ada settling pond. Tambahkan yang pertama.</p>}
        </section>
        {form && <PondForm key={form.id ?? 'new'} initial={form} onCancel={() => setForm(null)} onDone={() => { setForm(null); load(); reloadPickers(); }} />}
      </div>
    </>
  );
}
