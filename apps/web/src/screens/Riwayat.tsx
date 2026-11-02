import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { canWrite, formatNumber, isOutOfLimit, type Threshold } from '@evo/shared';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../icons';
import { dayMonth } from '../lib/dates';
import type { Pond } from '../pond/PondContext';
import { Badge } from '../ui/Badge';
import { DataTable, type Column } from '../ui/DataTable';
import { Segmented } from '../ui/Segmented';
import { ScreenHeader } from '../ui/ScreenHeader';
import { pondLabel } from '../ui/PondPicker';
import { localToday } from './input/DayScope';

type Water = { ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null; debit_inlet_m3d: number | null; debit_outlet_m3d: number | null };
type Coag = { type: string; stock_in: number | null; stock_out: number | null; stock_remaining: number | null; staleRemaining: boolean };
type Entry = { date: string; sp_id: string | null; weather: { rainfall_mm: number | null; rain_hours: number | null } | null; water: Water | null; coagulant: Coag[] };
type View = 'air' | 'cuaca' | 'koagulan';

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };
const dateText = (iso: string) => `${dayMonth(iso)} ${iso.slice(0, 4)}`;
const num = (v: number | null, decimals = 3) => formatNumber(v, decimals);

export function Riwayat() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [from, setFrom] = useState(daysAgo(14));
  const [to, setTo] = useState(localToday());
  const [sp, setSp] = useState('');
  const [view, setView] = useState<View>('air');
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

  const pondText = (id: string | null) => { const p = id ? byId.get(id) : undefined; return p ? pondLabel(p) : id ? 'Pond' : '–'; };
  const limit = (id: string | null, key: string): Threshold | undefined => (id ? byId.get(id)?.thresholds?.[key] : undefined);
  const bad = (v: number | null, t: Threshold | undefined) => (isOutOfLimit(v, t) ? 'is-bad' : '');

  const action = <R extends { date: string; sp_id: string | null }>(module: string, withPond: boolean): Column<R>[] =>
    writer
      ? [{
          key: 'aksi', header: 'Aksi',
          render: (r) => (
            <Link className="ui-iconbtn" to={`/input/${module}?date=${r.date}${r.sp_id ? `&sp=${r.sp_id}` : ''}`}
              aria-label={`Ubah ${dateText(r.date)}${withPond ? ` ${pondText(r.sp_id)}` : ''}`}><Icon name="pencil" /></Link>
          ),
        }]
      : [];

  const airRows = useMemo(() => (entries ?? []).filter((e) => e.water).map((e) => ({ ...e, water: e.water! })), [entries]);
  const weatherRows = useMemo(() => {
    const m = new Map<string, { date: string; sp_id: string | null; w: NonNullable<Entry['weather']> }>();
    for (const e of entries ?? []) if (e.weather && !m.has(e.date)) m.set(e.date, { date: e.date, sp_id: null, w: e.weather });
    return [...m.values()];
  }, [entries]);
  const coagRows = useMemo(() => (entries ?? []).flatMap((e) => e.coagulant.map((c) => ({ date: e.date, sp_id: e.sp_id, c }))), [entries]);

  type Air = (typeof airRows)[number];
  const airCols: Column<Air>[] = [
    { key: 'date', header: 'Tanggal', sticky: true, render: (r) => dateText(r.date) },
    { key: 'pond', header: 'Pond', render: (r) => pondText(r.sp_id) },
    { key: 'phi', header: 'pH inlet', align: 'right', render: (r) => num(r.water.ph_inlet) },
    { key: 'pho', header: 'pH outlet', align: 'right', render: (r) => num(r.water.ph_outlet), cellClass: (r) => bad(r.water.ph_outlet, limit(r.sp_id, 'ph_outlet')) },
    { key: 'tssi', header: 'TSS inlet', align: 'right', render: (r) => num(r.water.tss_inlet) },
    { key: 'tsso', header: 'TSS outlet', align: 'right', render: (r) => num(r.water.tss_outlet), cellClass: (r) => bad(r.water.tss_outlet, limit(r.sp_id, 'tss_outlet')) },
    { key: 'di', header: 'Debit inlet (m³/d)', align: 'right', render: (r) => num(r.water.debit_inlet_m3d, 1) },
    { key: 'do', header: 'Debit outlet (m³/d)', align: 'right', render: (r) => num(r.water.debit_outlet_m3d, 1) },
    ...action<Air>('air', true),
  ];
  type Wx = (typeof weatherRows)[number];
  const weatherCols: Column<Wx>[] = [
    { key: 'date', header: 'Tanggal', sticky: true, render: (r) => dateText(r.date) },
    { key: 'rain', header: 'Rainfall (mm)', align: 'right', render: (r) => num(r.w.rainfall_mm) },
    { key: 'hours', header: 'Rain hours (jam)', align: 'right', render: (r) => num(r.w.rain_hours) },
    ...action<Wx>('cuaca', false),
  ];
  type Cg = (typeof coagRows)[number];
  const coagCols: Column<Cg>[] = [
    { key: 'date', header: 'Tanggal', sticky: true, render: (r) => dateText(r.date) },
    { key: 'pond', header: 'Pond', render: (r) => pondText(r.sp_id) },
    { key: 'type', header: 'Jenis', render: (r) => r.c.type },
    { key: 'in', header: 'Masuk', align: 'right', render: (r) => num(r.c.stock_in) },
    { key: 'out', header: 'Keluar', align: 'right', render: (r) => num(r.c.stock_out) },
    { key: 'left', header: 'Sisa', align: 'right', render: (r) => (r.c.staleRemaining ? <>{num(r.c.stock_remaining)} <Badge tone="warning">Selisih</Badge></> : num(r.c.stock_remaining)) },
    ...action<Cg>('koagulan', true),
  ];
  const empty = 'Tidak ada data pada rentang ini.';

  return (
    <>
      <ScreenHeader title="Riwayat" subtitle="Data yang sudah dicatat" onProfile={() => nav('/akun')} />
      <div className="ui-page ui-page--wide">
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
        <Segmented label="Jenis data" options={[{ value: 'air', label: 'Air permukaan' }, { value: 'cuaca', label: 'Cuaca' }, { value: 'koagulan', label: 'Koagulan' }]} value={view} onChange={setView} />
        {error && <p className="ui-error" role="alert">{error}</p>}
        {!entries && !error && <p className="ui-muted">Memuat…</p>}
        {entries && view === 'air' && <DataTable caption="Air permukaan" columns={airCols} rows={airRows} rowKey={(r) => `${r.date}|${r.sp_id}`} emptyText={empty} />}
        {entries && view === 'cuaca' && <DataTable caption="Cuaca" columns={weatherCols} rows={weatherRows} rowKey={(r) => r.date} emptyText={empty} />}
        {entries && view === 'koagulan' && <DataTable caption="Koagulan" columns={coagCols} rows={coagRows} rowKey={(r) => `${r.date}|${r.sp_id}|${r.c.type}`} emptyText={empty} />}
      </div>
    </>
  );
}
