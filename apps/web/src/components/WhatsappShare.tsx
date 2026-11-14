import { useEffect, useMemo, useState } from 'react';
import { formatNumber } from '@evo/shared';
import type { DayData } from '../hooks/useDay';
import { buildWaReport, whatsappUrl, witaTime, type WaExtras } from '../lib/waReport';
import { Button } from '../ui/Button';
import { useToast } from './Toast';

type Props = { title: string; placeCode: string; date: string; data: DayData; onClose: () => void };

function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div className="ui-num">
      <div className="ui-num__top"><label>{label}</label></div>
      <div className="ui-num__box"><input type="text" aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} /></div>
      {hint && <small className="ui-num__hint">{hint}</small>}
    </div>
  );
}

/** The report message for one pond and day, filled from the saved data, ready to send to a WhatsApp group. */
export function WhatsappShare({ title, placeCode, date, data, onClose }: Props) {
  const toast = useToast();
  const [time] = useState(() => witaTime());
  const [x, setX] = useState<WaExtras>({ places: [{ label: placeCode, sack: '0' }, { label: '', sack: '0' }], batu: '0', serbuk: '0', remain: '', pintu: 'Terbuka', pompa: '' });
  const set = (patch: Partial<WaExtras>) => setX((p) => ({ ...p, ...patch }));
  const setPlace = (i: number, patch: Partial<WaExtras['places'][number]>) => set({ places: x.places.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  const text = useMemo(() => buildWaReport({ title, date, time, weather: data.weather, water: data.water, extras: x }), [title, date, time, data, x]);
  const kg = (t: 'Tawas Batu' | 'Tawas Serbuk') => { const o = data.coagulant[t]?.stock_out; return o == null ? undefined : `Di aplikasi: ${formatNumber(o)} kg keluar`; };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function copy() {
    try { await navigator.clipboard.writeText(text); toast('Teks disalin'); } catch { toast('Tidak bisa menyalin, pilih teks lalu salin manual'); }
  }

  return (
    <div className="ui-outbox" role="dialog" aria-modal="true" aria-label="Kirim ke WhatsApp">
      <div className="ui-outbox__panel">
        <div className="ui-outbox__head">
          <h2>Kirim ke WhatsApp</h2>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </div>
        <p className="ui-muted">Angka air dan cuaca diambil dari data yang sudah tersimpan. Lengkapi bagian lain, lalu kirim dan pilih grup di WhatsApp.</p>
        <div className="ui-stack">
          {x.places.map((p, i) => (
            <div className="ui-two" key={i}>
              <Field label={`Lokasi koagulan ${i + 1}`} value={p.label} onChange={(v) => setPlace(i, { label: v })} placeholder={i ? 'mis. CB-2' : undefined} />
              <Field label={`Sack ${i + 1}`} value={p.sack} onChange={(v) => setPlace(i, { sack: v })} />
            </div>
          ))}
          <div className="ui-two">
            <Field label="Batu (sack)" value={x.batu} onChange={(v) => set({ batu: v })} hint={kg('Tawas Batu')} />
            <Field label="Serbuk (sack)" value={x.serbuk} onChange={(v) => set({ serbuk: v })} hint={kg('Tawas Serbuk')} />
          </div>
          <Field label="Remain (sack)" value={x.remain} onChange={(v) => set({ remain: v })} />
          <Field label="Pintu air" value={x.pintu} onChange={(v) => set({ pintu: v })} placeholder="mis. Terbuka 9 valve" />
          <Field label="Pompa" value={x.pompa} onChange={(v) => set({ pompa: v })} placeholder="Kosongkan bila tidak ada" />
        </div>
        <pre className="ui-wa__preview" aria-label="Pratinjau pesan">{text}</pre>
        <div className="ui-outbox__actions">
          <Button onClick={() => { window.open(whatsappUrl(text), '_blank', 'noopener'); }}>Kirim ke WhatsApp</Button>
          <Button variant="outline" onClick={copy}>Salin teks</Button>
        </div>
      </div>
    </div>
  );
}
