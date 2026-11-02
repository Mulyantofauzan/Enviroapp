import { useRef, useState } from 'react';
import { m3sToM3d } from '@evo/shared';
import { put } from '../api/client';
import { Icon } from '../icons';
import { useToast } from '../components/Toast';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { Segmented } from '../ui/Segmented';
import { DayScope, type DayCtx } from './input/DayScope';
import { hasInvalid } from './input/coag';

type N = number | null;
type Point = { ph: N; tss: N; flow: N };
type Side = 'inlet' | 'outlet';
const SIDE_LABEL: Record<Side, string> = { inlet: 'Inlet', outlet: 'Outlet' };

function AirForm({ date, sp, data, thresholds, canEdit, reload }: DayCtx) {
  const toast = useToast();
  const refs = { inlet: useRef<HTMLDivElement>(null), outlet: useRef<HTMLDivElement>(null) };
  const w = data.water;
  const [side, setSide] = useState<Side>('inlet');
  const [pts, setPts] = useState<Record<Side, Point>>({
    inlet: { ph: w?.ph_inlet ?? null, tss: w?.tss_inlet ?? null, flow: w?.debit_inlet_m3s ?? null },
    outlet: { ph: w?.ph_outlet ?? null, tss: w?.tss_outlet ?? null, flow: w?.debit_outlet_m3s ?? null },
  });
  const [busy, setBusy] = useState(false);
  const set = (s: Side, patch: Partial<Point>) => setPts((p) => ({ ...p, [s]: { ...p[s], ...patch } }));

  async function save() {
    for (const s of ['inlet', 'outlet'] as Side[]) {
      if (hasInvalid(refs[s].current)) {
        setSide(s);
        return toast('Perbaiki angka yang ditandai dulu.');
      }
    }
    setBusy(true);
    try {
      await put(`/water/${date}/${sp}`, {
        ph_inlet: pts.inlet.ph, tss_inlet: pts.inlet.tss, debit_inlet_m3s: pts.inlet.flow,
        ph_outlet: pts.outlet.ph, tss_outlet: pts.outlet.tss, debit_outlet_m3s: pts.outlet.flow,
      });
      toast('Data air tersimpan');
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
      <section key={s} ref={refs[s]} hidden={side !== s} className="ui-card ui-module" aria-label={`Titik ${SIDE_LABEL[s]}`}>
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
    <div className="ui-stack">
      <Segmented label="Titik pengukuran" options={[{ value: 'inlet', label: 'Inlet' }, { value: 'outlet', label: 'Outlet' }]} value={side} onChange={setSide} />
      {panel('inlet')}
      {panel('outlet')}
      <Banner tone="warning" title="Nilai abnormal hanya disorot">Data tetap tersimpan, tidak diblokir</Banner>
      {canEdit && <Button block disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan data air'}</Button>}
    </div>
  );
}

export function InputAir() {
  return <DayScope title="Air Permukaan">{(c) => <AirForm {...c} />}</DayScope>;
}
