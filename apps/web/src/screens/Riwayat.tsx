import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { canWrite, formatDateId, formatNumber, isOutOfLimit, type Threshold } from '@evo/shared';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Pond } from '../pond/PondContext';
import { ScreenHeader } from '../ui/ScreenHeader';
import { pondLabel } from '../ui/PondPicker';
import { localToday } from './input/DayScope';

type Water = { ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null; debit_inlet_m3d: number | null; debit_outlet_m3d: number | null };
type Entry = {
  date: string; sp_id: string | null;
  weather: { rainfall_mm: number | null; rain_hours: number | null } | null;
  water: Water | null;
  coagulant: { type: string; stock_in: number | null; stock_out: number | null; stock_remaining: number | null; staleRemaining: boolean }[];
};

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
};

function Val({ v, t, decimals = 3 }: { v: number | null; t?: Threshold; decimals?: number }) {
  return <span className={`ui-val${isOutOfLimit(v, t) ? ' is-bad' : ''}`}>{formatNumber(v, decimals)}</span>;
}

export function Riwayat() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [from, setFrom] = useState(daysAgo(14));
  const [to, setTo] = useState(localToday());
  const [sp, setSp] = useState('');
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');
  const byId = useMemo(() => new Map(ponds.map((p) => [p.id, p])), [ponds]);
  const writer = !!user && canWrite(user.role);

  useEffect(() => { api<Pond[]>('/ponds?all=1').then(setPonds).catch(() => {}); }, []);
  useEffect(() => {
    let live = true;
    setEntries(null);
    setError('');
    api<Entry[]>(`/history?from=${from}&to=${to}${sp ? `&sp=${sp}` : ''}`).then((e) => live && setEntries(e)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [from, to, sp]);

  return (
    <>
      <ScreenHeader title="Riwayat" subtitle="Data yang sudah dicatat" onProfile={() => nav('/akun')} />
      <div className="ui-page">
        <section className="ui-card ui-filters" aria-label="Filter">
          <label><span>Dari</span><input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label><span>Sampai</span><input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
          <label className="ui-filters__wide"><span>Settling Pond</span>
            <select value={sp} onChange={(e) => setSp(e.target.value)}>
              <option value="">Semua pond</option>
              {ponds.map((p) => <option key={p.id} value={p.id}>{pondLabel(p)}</option>)}
            </select>
          </label>
        </section>
        {error && <p className="ui-error" role="alert">{error}</p>}
        {!entries && !error && <p className="ui-muted">Memuat…</p>}
        {entries?.length === 0 && <p className="ui-muted">Tidak ada data pada rentang ini.</p>}
        {entries?.map((e) => {
          const pond = e.sp_id ? byId.get(e.sp_id) : undefined;
          const th = pond?.thresholds ?? {};
          const module = e.water ? 'air' : e.weather ? 'cuaca' : 'koagulan';
          const body = (
            <>
              <div className="ui-hist__head"><strong>{formatDateId(e.date)}</strong><span>{pond ? pondLabel(pond) : e.sp_id ? 'Pond' : 'Semua pond'}</span></div>
              {e.weather && <p>Hujan <Val v={e.weather.rainfall_mm} /> mm, <Val v={e.weather.rain_hours} /> jam</p>}
              {e.water && (
                <>
                  <p>pH inlet <Val v={e.water.ph_inlet} /> / outlet <Val v={e.water.ph_outlet} t={th.ph_outlet} /></p>
                  <p>TSS inlet <Val v={e.water.tss_inlet} /> / outlet <Val v={e.water.tss_outlet} t={th.tss_outlet} /> mg/L</p>
                  <p>Debit inlet <Val v={e.water.debit_inlet_m3d} decimals={1} /> / outlet <Val v={e.water.debit_outlet_m3d} decimals={1} /> m³/d</p>
                </>
              )}
              {e.coagulant.map((c) => (
                <p key={c.type}>
                  {c.type}: masuk <Val v={c.stock_in} />, keluar <Val v={c.stock_out} />, sisa <Val v={c.stock_remaining} />
                  {c.staleRemaining && <em className="ui-stale">Selisih hitungan stok dengan hari sebelumnya</em>}
                </p>
              ))}
            </>
          );
          const key = `${e.date}|${e.sp_id}`;
          return writer
            ? <Link key={key} className="ui-card ui-hist" to={`/input/${module}?date=${e.date}${e.sp_id ? `&sp=${e.sp_id}` : ''}`}>{body}</Link>
            : <div key={key} className="ui-card ui-hist">{body}</div>;
        })}
      </div>
    </>
  );
}
