import { useMemo, useRef, useState } from 'react';
import { COAGULANT_TYPES, isOutOfLimit, type CoagulantType, type Threshold } from '@evo/shared';
import { put } from '../api/client';
import { useToast } from '../components/Toast';
import type { DayData } from '../hooks/useDay';
import { FlowStrip } from '../components/FlowStrip';
import { NumberField } from '../components/NumberField';
import { CoagulantRow, effectiveRemaining, type CoagState } from '../components/CoagulantRow';
import { SaveBar } from '../components/SaveBar';

type N = number | null;
type Water = { ph_inlet: N; ph_outlet: N; tss_inlet: N; tss_outlet: N; debit_inlet_m3s: N; debit_outlet_m3s: N };
const emptyWater: Water = { ph_inlet: null, ph_outlet: null, tss_inlet: null, tss_outlet: null, debit_inlet_m3s: null, debit_outlet_m3s: null };
const emptyCoag: CoagState = { stock_in: null, stock_out: null, stock_remaining: null };

function initialCoag(data: DayData): Record<CoagulantType, CoagState> {
  return Object.fromEntries(COAGULANT_TYPES.map((t) => {
    const r = data.coagulant[t];
    if (!r) return [t, emptyCoag];
    // A saved remaining counts as typed only when it differs from the calculation.
    const calc = effectiveRemaining(data.previousRemaining[t], { stock_in: r.stock_in, stock_out: r.stock_out, stock_remaining: null });
    const override = r.stock_remaining !== null && r.stock_remaining !== calc ? r.stock_remaining : null;
    return [t, { stock_in: r.stock_in, stock_out: r.stock_out, stock_remaining: override }];
  })) as Record<CoagulantType, CoagState>;
}

type Props = {
  date: string; sp: string; data: DayData; thresholds: Record<string, Threshold>;
  canEdit: boolean; onSaved: () => void;
};

/** One day for one pond. The parent keys it on date, pond and load, so state always starts from `data`. */
export function DayForm({ date, sp, data, thresholds, canEdit, onSaved }: Props) {
  const toast = useToast();
  const root = useRef<HTMLDivElement>(null);
  const [weather, setWeather] = useState({ rainfall_mm: data.weather?.rainfall_mm ?? null as N, rain_hours: data.weather?.rain_hours ?? null as N });
  const [water, setWater] = useState<Water>({ ...emptyWater, ...(data.water ?? {}) });
  const [coag, setCoag] = useState(() => initialCoag(data));
  const [busy, setBusy] = useState(false);

  const outletOut = useMemo(
    () => isOutOfLimit(water.ph_outlet, thresholds.ph_outlet) || isOutOfLimit(water.tss_outlet, thresholds.tss_outlet),
    [water, thresholds],
  );

  async function save() {
    if (root.current?.querySelector('[aria-invalid="true"]')) {
      toast('Fix the highlighted numbers first.');
      return;
    }
    setBusy(true);
    try {
      if (data.weather || weather.rainfall_mm !== null || weather.rain_hours !== null) await put(`/weather/${date}`, weather);
      if (data.water || Object.values(water).some((v) => v !== null)) await put(`/water/${date}/${sp}`, water);
      for (const t of COAGULANT_TYPES) {
        const v = coag[t];
        if (!data.coagulant[t] && v.stock_in === null && v.stock_out === null && v.stock_remaining === null) continue;
        await put(`/coagulant/${date}/${sp}/${encodeURIComponent(t)}`, {
          stock_in: v.stock_in, stock_out: v.stock_out, ...(v.stock_remaining !== null ? { stock_remaining: v.stock_remaining } : {}),
        });
      }
      toast('Day saved');
      onSaved();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ro = !canEdit;
  return (
    <div className="stack" ref={root}>
      <FlowStrip inletFlow={water.debit_inlet_m3s} outletFlow={water.debit_outlet_m3s} outletOut={outletOut} />

      <section className="stack">
        <h2>Weather</h2>
        <NumberField label="Rainfall" unit="mm" value={weather.rainfall_mm} readOnly={ro} onChange={(v) => setWeather({ ...weather, rainfall_mm: v })} />
        <NumberField label="Rain hours" unit="h" value={weather.rain_hours} readOnly={ro} onChange={(v) => setWeather({ ...weather, rain_hours: v })} />
      </section>

      <section className="stack">
        <h2>Water</h2>
        <div className="water-grid">
          <div className="stack">
            <h3>Inlet</h3>
            <NumberField label="pH inlet" value={water.ph_inlet} threshold={thresholds.ph_inlet} readOnly={ro} onChange={(v) => setWater({ ...water, ph_inlet: v })} />
            <NumberField label="TSS inlet" unit="mg/L" value={water.tss_inlet} threshold={thresholds.tss_inlet} readOnly={ro} onChange={(v) => setWater({ ...water, tss_inlet: v })} />
            <NumberField label="Flow inlet" unit="m³/s" value={water.debit_inlet_m3s} readOnly={ro} onChange={(v) => setWater({ ...water, debit_inlet_m3s: v })} />
          </div>
          <div className="stack">
            <h3>Outlet</h3>
            <NumberField label="pH outlet" value={water.ph_outlet} threshold={thresholds.ph_outlet} readOnly={ro} onChange={(v) => setWater({ ...water, ph_outlet: v })} />
            <NumberField label="TSS outlet" unit="mg/L" value={water.tss_outlet} threshold={thresholds.tss_outlet} readOnly={ro} onChange={(v) => setWater({ ...water, tss_outlet: v })} />
            <NumberField label="Flow outlet" unit="m³/s" value={water.debit_outlet_m3s} readOnly={ro} onChange={(v) => setWater({ ...water, debit_outlet_m3s: v })} />
          </div>
        </div>
      </section>

      <section className="stack">
        <h2>Coagulant</h2>
        {COAGULANT_TYPES.map((t) => (
          <CoagulantRow key={t} type={t} previousRemaining={data.previousRemaining[t]} value={coag[t]} readOnly={ro}
            onChange={(v) => setCoag({ ...coag, [t]: v })} />
        ))}
      </section>

      {canEdit && <SaveBar onSave={save} busy={busy} />}
    </div>
  );
}
