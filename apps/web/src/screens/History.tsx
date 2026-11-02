import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isOutOfLimit, type Threshold } from '@evo/shared';
import { api } from '../api/client';
import { useThresholds } from '../hooks/useThresholds';
import type { Pond } from '../components/PondChips';

type Water = { ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null; debit_inlet_m3d: number | null; debit_outlet_m3d: number | null };
type Entry = {
  date: string; sp_id: string | null;
  weather: { rainfall_mm: number | null; rain_hours: number | null } | null;
  water: Water | null;
  coagulant: { type: string; stock_in: number | null; stock_out: number | null; stock_remaining: number | null; staleRemaining: boolean }[];
};

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
};

function Val({ v, t }: { v: number | null; t?: Threshold }) {
  if (v === null) return <span className="val">–</span>;
  return <span className={isOutOfLimit(v, t) ? 'val is-alert' : 'val'}>{v}</span>;
}

export function History() {
  const [from, setFrom] = useState(day(-14));
  const [to, setTo] = useState(day(0));
  const [sp, setSp] = useState('');
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');
  const thresholds = useThresholds();
  const names = useMemo(() => new Map(ponds.map((p) => [p.id, p.name])), [ponds]);

  useEffect(() => { api<Pond[]>('/ponds?all=1').then(setPonds).catch(() => {}); }, []);
  useEffect(() => {
    setEntries(null);
    setError('');
    api<Entry[]>(`/history?from=${from}&to=${to}${sp ? `&sp=${sp}` : ''}`).then(setEntries).catch((e) => setError(e.message));
  }, [from, to, sp]);

  return (
    <div className="stack">
      <h2>History</h2>
      <div className="filters">
        <label className="field"><span>From</span><input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
        <label className="field"><span>To</span><input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
        <label className="field"><span>Pond</span>
          <select value={sp} onChange={(e) => setSp(e.target.value)}>
            <option value="">All ponds</option>
            {ponds.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {entries?.length === 0 && <p className="muted">No entries in this range.</p>}
      {entries?.map((e) => (
        <Link key={`${e.date}|${e.sp_id}`} className="hist-row" to={`/?date=${e.date}${e.sp_id ? `&sp=${e.sp_id}` : ''}`}>
          <div className="hist-head"><strong>{e.date}</strong><span>{e.sp_id ? names.get(e.sp_id) ?? 'Pond' : 'Site'}</span></div>
          {e.weather && <p>Rain <Val v={e.weather.rainfall_mm} /> mm · <Val v={e.weather.rain_hours} /> h</p>}
          {e.water && (
            <p>
              pH <Val v={e.water.ph_inlet} t={thresholds.ph_inlet} /> → <Val v={e.water.ph_outlet} t={thresholds.ph_outlet} />
              {' · '}TSS <Val v={e.water.tss_inlet} t={thresholds.tss_inlet} /> → <Val v={e.water.tss_outlet} t={thresholds.tss_outlet} />
              {' · '}Flow <Val v={e.water.debit_inlet_m3d} /> → <Val v={e.water.debit_outlet_m3d} /> m³/d
            </p>
          )}
          {e.coagulant.map((c) => (
            <p key={c.type}>
              {c.type}: in <Val v={c.stock_in} />, out <Val v={c.stock_out} />, left <Val v={c.stock_remaining} />
              {c.staleRemaining && <em className="stale"> Stock count differs from earlier edits</em>}
            </p>
          ))}
        </Link>
      ))}
    </div>
  );
}
