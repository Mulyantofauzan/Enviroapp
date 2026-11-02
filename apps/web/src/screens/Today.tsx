import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { COAGULANT_TYPES, canWrite, isOutOfLimit, type CoagulantType } from '@evo/shared';
import { api, put } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { useDay } from '../hooks/useDay';
import { useThresholds } from '../hooks/useThresholds';
import { PondChips, type Pond } from '../components/PondChips';
import { FlowStrip } from '../components/FlowStrip';
import { NumberField } from '../components/NumberField';
import { CoagulantRow, effectiveRemaining, type CoagState } from '../components/CoagulantRow';
import { SaveBar } from '../components/SaveBar';

const localToday = () => new Date().toLocaleDateString('en-CA');
type N = number | null;
type Water = { ph_inlet: N; ph_outlet: N; tss_inlet: N; tss_outlet: N; debit_inlet_m3s: N; debit_outlet_m3s: N };
const emptyWater: Water = { ph_inlet: null, ph_outlet: null, tss_inlet: null, tss_outlet: null, debit_inlet_m3s: null, debit_outlet_m3s: null };
const emptyCoag: CoagState = { stock_in: null, stock_out: null, stock_remaining: null };

export function Today() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || localToday();
  const [ponds, setPonds] = useState<Pond[]>([]);
  const sp = params.get('sp') || ponds[0]?.id || null;
  const thresholds = useThresholds();
  const { data, error, reload } = useDay(date, sp);
  const editable = !!user && canWrite(user.role);

  const [weather, setWeather] = useState({ rainfall_mm: null as N, rain_hours: null as N });
  const [water, setWater] = useState<Water>(emptyWater);
  const [coag, setCoag] = useState<Record<CoagulantType, CoagState>>(
    () => Object.fromEntries(COAGULANT_TYPES.map((t) => [t, emptyCoag])) as Record<CoagulantType, CoagState>,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<Pond[]>('/ponds').then(setPonds).catch((e) => toast(e.message)); }, []); // eslint-disable-line

  useEffect(() => {
    if (!data) return;
    setWeather({ rainfall_mm: data.weather?.rainfall_mm ?? null, rain_hours: data.weather?.rain_hours ?? null });
    setWater({ ...emptyWater, ...(data.water ?? {}) });
    setCoag(Object.fromEntries(COAGULANT_TYPES.map((t) => {
      const r = data.coagulant[t];
      // A saved remaining is shown as typed only when it differs from the calculation.
      const calc = effectiveRemaining(data.previousRemaining[t], { stock_in: r?.stock_in ?? null, stock_out: r?.stock_out ?? null, stock_remaining: null });
      const override = r && r.stock_remaining !== null && r.stock_remaining !== calc ? r.stock_remaining : null;
      return [t, r ? { stock_in: r.stock_in, stock_out: r.stock_out, stock_remaining: override } : emptyCoag];
    })) as Record<CoagulantType, CoagState>);
  }, [data]);

  const outletOut = useMemo(
    () => isOutOfLimit(water.ph_outlet, thresholds.ph_outlet) || isOutOfLimit(water.tss_outlet, thresholds.tss_outlet),
    [water, thresholds],
  );

  const setQuery = (patch: Record<string, string>) => setParams({ date, ...(sp ? { sp } : {}), ...patch }, { replace: true });

  async function save() {
    if (!sp) return;
    setBusy(true);
    try {
      const hadWeather = !!data?.weather;
      if (hadWeather || weather.rainfall_mm !== null || weather.rain_hours !== null) await put(`/weather/${date}`, weather);
      const hadWater = !!data?.water;
      if (hadWater || Object.values(water).some((v) => v !== null)) await put(`/water/${date}/${sp}`, water);
      for (const t of COAGULANT_TYPES) {
        const v = coag[t];
        const had = !!data?.coagulant[t];
        if (!had && v.stock_in === null && v.stock_out === null && v.stock_remaining === null) continue;
        await put(`/coagulant/${date}/${sp}/${encodeURIComponent(t)}`, {
          stock_in: v.stock_in, stock_out: v.stock_out, ...(v.stock_remaining !== null ? { stock_remaining: v.stock_remaining } : {}),
        });
      }
      toast('Day saved');
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (ponds.length === 0) return <p className="muted center">No active ponds yet. Ask an admin to add one.</p>;

  return (
    <div className="stack today">
      <label className="field">
        <span>Date</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setQuery({ date: e.target.value })} />
      </label>
      <PondChips ponds={ponds} value={sp} onChange={(id) => setQuery({ sp: id })} />
      <FlowStrip inletFlow={water.debit_inlet_m3s} outletFlow={water.debit_outlet_m3s} outletOut={outletOut} />
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="stack">
        <h2>Weather</h2>
        <NumberField label="Rainfall" unit="mm" value={weather.rainfall_mm} readOnly={!editable} onChange={(v) => setWeather({ ...weather, rainfall_mm: v })} />
        <NumberField label="Rain hours" unit="h" value={weather.rain_hours} readOnly={!editable} onChange={(v) => setWeather({ ...weather, rain_hours: v })} />
      </section>

      <section className="stack">
        <h2>Water</h2>
        <div className="water-grid">
          <div className="stack">
            <h3>Inlet</h3>
            <NumberField label="pH inlet" value={water.ph_inlet} threshold={thresholds.ph_inlet} readOnly={!editable} onChange={(v) => setWater({ ...water, ph_inlet: v })} />
            <NumberField label="TSS inlet" unit="mg/L" value={water.tss_inlet} threshold={thresholds.tss_inlet} readOnly={!editable} onChange={(v) => setWater({ ...water, tss_inlet: v })} />
            <NumberField label="Flow inlet" unit="m³/s" value={water.debit_inlet_m3s} readOnly={!editable} onChange={(v) => setWater({ ...water, debit_inlet_m3s: v })} />
          </div>
          <div className="stack">
            <h3>Outlet</h3>
            <NumberField label="pH outlet" value={water.ph_outlet} threshold={thresholds.ph_outlet} readOnly={!editable} onChange={(v) => setWater({ ...water, ph_outlet: v })} />
            <NumberField label="TSS outlet" unit="mg/L" value={water.tss_outlet} threshold={thresholds.tss_outlet} readOnly={!editable} onChange={(v) => setWater({ ...water, tss_outlet: v })} />
            <NumberField label="Flow outlet" unit="m³/s" value={water.debit_outlet_m3s} readOnly={!editable} onChange={(v) => setWater({ ...water, debit_outlet_m3s: v })} />
          </div>
        </div>
      </section>

      <section className="stack">
        <h2>Coagulant</h2>
        {COAGULANT_TYPES.map((t) => (
          <CoagulantRow key={t} type={t} previousRemaining={data?.previousRemaining[t] ?? null} value={coag[t]} readOnly={!editable}
            onChange={(v) => setCoag({ ...coag, [t]: v })} />
        ))}
      </section>

      {editable && <SaveBar onSave={save} busy={busy} />}
    </div>
  );
}
