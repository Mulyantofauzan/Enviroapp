import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COAGULANT_TYPES, formatNumber, isOutOfLimit, type Threshold } from '@evo/shared';
import { useDashboard } from '../hooks/useDashboard';
import { usePond } from '../pond/PondContext';
import { ScreenHeader } from '../ui/ScreenHeader';
import { PondPicker } from '../ui/PondPicker';
import { Segmented } from '../ui/Segmented';
import { Badge } from '../ui/Badge';
import { PhChart } from '../components/PhChart';
import { StockBars } from '../components/StockBars';
import { localToday } from './input/DayScope';

type Days = '7' | '30' | '90';
const dayMonth = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00Z`)).replace('.', '');
const full = (iso: string) => `${dayMonth(iso)} ${iso.slice(0, 4)}`;

function Kpi({ label, value, unit, sub, tone }: { label: string; value: number | null; unit?: string; sub?: string; tone?: 'abnormal' | 'normal' | null }) {
  return (
    <div className="ui-card ui-kpi" role="group" aria-label={label}>
      <span className="ui-kpi__label">{label}</span>
      <strong className={tone === 'abnormal' ? 'is-bad' : ''}>{formatNumber(value, 1)}{unit && <small> {unit}</small>}</strong>
      {tone && <Badge tone={tone === 'abnormal' ? 'danger' : 'success'}>{tone === 'abnormal' ? 'Abnormal' : 'Normal'}</Badge>}
      {sub && <span className="ui-kpi__sub">{sub}</span>}
    </div>
  );
}

const judge = (v: number | null, t: Threshold | undefined): 'abnormal' | 'normal' | null =>
  v === null || !t || (t.min === null && t.max === null) ? null : isOutOfLimit(v, t) ? 'abnormal' : 'normal';

export function BerandaManager() {
  const nav = useNavigate();
  const { ponds, current, setCurrent, loading } = usePond();
  const [days, setDays] = useState<Days>('7');
  const { data, error } = useDashboard(current, Number(days) as 7 | 30 | 90, localToday());
  const th = data?.thresholds ?? {};
  const t = data?.today ?? null;
  const range = data && data.series.length ? `${dayMonth(data.series[0].date)} s/d ${full(data.series[data.series.length - 1].date)}` : '';
  const hasPh = !!data?.series.some((s) => s.ph_inlet !== null || s.ph_outlet !== null);

  return (
    <>
      <ScreenHeader title="Dashboard" subtitle={`Manager${range ? ` - ${range}` : ''}`} onProfile={() => nav('/akun')} />
      <div className="ui-page">
        {!loading && ponds.length === 0 ? (
          <p className="ui-muted">Belum ada settling pond aktif. Minta admin menambahkannya di menu Master.</p>
        ) : (
          <>
            <PondPicker ponds={ponds} value={current} onChange={setCurrent} label="Settling Pond" />
            <Segmented label="Rentang waktu" options={[{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }]} value={days} onChange={setDays} />
            {error && <p className="ui-error" role="alert">{error}</p>}
            {!data && !error && <p className="ui-muted">Memuat…</p>}
            {data && (
              <>
                {t ? (
                  <div className="ui-kpis">
                    <Kpi label="pH Outlet hari ini" value={t.ph_outlet} tone={judge(t.ph_outlet, th.ph_outlet)} />
                    <Kpi label="TSS Outlet" value={t.tss_outlet} unit="mg/L" tone={judge(t.tss_outlet, th.tss_outlet)} />
                    <Kpi label="Debit harian (otomatis)" value={t.debit_outlet_m3d} unit="m³/d" sub={t.debit_outlet_m3s === null ? undefined : `Dari ${formatNumber(t.debit_outlet_m3s, 4)} m³/s`} />
                    <Kpi label="Curah hujan" value={t.rainfall_mm} unit="mm" sub={t.rain_hours === null ? undefined : `${formatNumber(t.rain_hours)} jam hujan`} />
                  </div>
                ) : (
                  <section className="ui-card"><p className="ui-muted">Belum ada data hari ini.</p></section>
                )}
                <section className="ui-card">
                  <h2>pH Inlet vs Outlet</h2>
                  {hasPh ? <PhChart series={data.series} band={th.ph_outlet} /> : <p className="ui-muted">Belum ada data pH pada rentang ini.</p>}
                </section>
                <section className="ui-card">
                  <h2>Sisa stok koagulan (kg)</h2>
                  <StockBars items={COAGULANT_TYPES.map((c) => ({ type: c, ...data.coagulant[c] }))} />
                </section>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
