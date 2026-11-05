import { useRef, useState } from 'react';
import { COAGULANT_TYPES, formatNumber, m3sToM3d, type CoagulantType } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { saveEntry } from '../lib/outbox/save';
import { dayMonth } from '../lib/dates';
import { Icon } from '../icons';
import { useToast } from '../components/Toast';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { DayScope, type DayCtx } from './input/DayScope';
import { effectiveRemaining, hasInvalid, initialCoag, type CoagState } from './input/coag';

type N = number | null;
type Point = { ph: N; tss: N; flow: N };
type Side = 'inlet' | 'outlet';
const SIDE_LABEL: Record<Side, string> = { inlet: 'Inlet', outlet: 'Outlet' };

function AirKoagulanForm({ date, sp, data, thresholds, canEdit, reload }: DayCtx) {
  const toast = useToast();
  const { user } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const w = data.water;
  const [pts, setPts] = useState<Record<Side, Point>>({
    inlet: { ph: w?.ph_inlet ?? null, tss: w?.tss_inlet ?? null, flow: w?.debit_inlet_m3s ?? null },
    outlet: { ph: w?.ph_outlet ?? null, tss: w?.tss_outlet ?? null, flow: w?.debit_outlet_m3s ?? null },
  });
  const [coag, setCoag] = useState(() => initialCoag(data));
  const [busy, setBusy] = useState(false);
  const patchCoag = (t: CoagulantType, v: Partial<CoagState>) => setCoag((c) => ({ ...c, [t]: { ...c[t], ...v } }));
  const set = (s: Side, patch: Partial<Point>) => setPts((p) => ({ ...p, [s]: { ...p[s], ...patch } }));

  async function save() {
    if (hasInvalid(root.current)) return toast('Perbaiki angka yang ditandai dulu.');
    setBusy(true);
    try {
      let queued = false;
      const waterEmpty = Object.values(pts).every((p) => p.ph === null && p.tss === null && p.flow === null);
      if (data.water || !waterEmpty) {
        const r = await saveEntry({
          owner: user!.id, kind: 'water', key: `water|${date}|${sp}`, label: `Air ${dayMonth(date)}`, path: `/water/${date}/${sp}`,
          body: {
            ph_inlet: pts.inlet.ph, tss_inlet: pts.inlet.tss, debit_inlet_m3s: pts.inlet.flow,
            ph_outlet: pts.outlet.ph, tss_outlet: pts.outlet.tss, debit_outlet_m3s: pts.outlet.flow,
          },
        });
        queued = r.queued;
      }
      for (const t of COAGULANT_TYPES) {
        const v = coag[t];
        if (!data.coagulant[t] && v.stock_in === null && v.stock_out === null && v.stock_remaining === null) continue;
        const r = await saveEntry({
          owner: user!.id, kind: 'coagulant', key: `coagulant|${date}|${sp}|${t}`, label: `${t} ${dayMonth(date)}`,
          path: `/coagulant/${date}/${sp}/${encodeURIComponent(t)}`,
          body: { stock_in: v.stock_in, stock_out: v.stock_out, ...(v.stock_remaining !== null ? { stock_remaining: v.stock_remaining } : {}) },
        });
        queued = queued || r.queued;
      }
      if (queued) { toast('Tersimpan di HP, menunggu sinyal'); return; }
      toast('Data air & koagulan tersimpan');
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const panel = (s: Side) => {
    const p = pts[s];
    const outlet = s === 'outlet';
    const name = SIDE_LABEL[s].toLowerCase();
    return (
      <section key={s} className="ui-card ui-module" aria-label={`Titik ${SIDE_LABEL[s]}`}>
        <h2><span className="ui-bubble ui-bubble--primary"><Icon name="droplet" /></span> Titik {SIDE_LABEL[s]}</h2>
        <div className="ui-two">
          <NumberInput label="pH" ariaLabel={`pH ${name}`} value={p.ph} onChange={(v) => set(s, { ph: v })} readOnly={!canEdit} threshold={outlet ? thresholds.ph_outlet : undefined} unit="pH" />
          <NumberInput label="TSS" ariaLabel={`TSS ${name}`} unit="mg/L" value={p.tss} onChange={(v) => set(s, { tss: v })} readOnly={!canEdit} threshold={outlet ? thresholds.tss_outlet : undefined} />
        </div>
        <NumberInput label="Debit (per detik)" ariaLabel={`Debit ${name} per detik`} unit="m³/s" value={p.flow} onChange={(v) => set(s, { flow: v })} readOnly={!canEdit} />
        <NumberInput label="Debit harian" ariaLabel={`Debit harian ${name}`} unit="m³/d" auto readOnly value={p.flow === null ? null : m3sToM3d(p.flow)} onChange={() => {}} hint="Dihitung otomatis dari m³/s" />
      </section>
    );
  };

  return (
    <div className="ui-stack" ref={root}>
      {panel('inlet')}
      {panel('outlet')}
      {COAGULANT_TYPES.map((t) => {
        const prev = data.previousRemaining[t];
        const remaining = effectiveRemaining(prev, coag[t]);
        return (
          <section key={t} className="ui-card ui-module" aria-label={t}>
            <h2>
              <span className="ui-bubble ui-bubble--warning"><Icon name="flask" /></span>
              <span>{t}<small>{prev === null ? 'Belum ada stok sebelumnya' : `Stok awal ${formatNumber(prev)} kg`}</small></span>
            </h2>
            <div className="ui-three">
              <NumberInput label="In" ariaLabel={`${t} masuk`} unit="kg" value={coag[t].stock_in} onChange={(v) => patchCoag(t, { stock_in: v })} readOnly={!canEdit} />
              <NumberInput label="Out" ariaLabel={`${t} keluar`} unit="kg" value={coag[t].stock_out} onChange={(v) => patchCoag(t, { stock_out: v })} readOnly={!canEdit} />
              <NumberInput label="Sisa" ariaLabel={`${t} sisa`} unit="kg" auto value={remaining} onChange={(v) => patchCoag(t, { stock_remaining: v })} readOnly={!canEdit} />
            </div>
            {remaining < 0 && <p className="ui-error">Stok di bawah nol. Periksa hitungan Anda.</p>}
          </section>
        );
      })}
      <Banner tone="warning" title="Nilai abnormal hanya disorot">Data tetap tersimpan, tidak diblokir</Banner>
      {canEdit && <Button block disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan data air & koagulan'}</Button>}
    </div>
  );
}

export function InputAir() {
  return <DayScope title="Air & Koagulan">{(c) => <AirKoagulanForm {...c} />}</DayScope>;
}
