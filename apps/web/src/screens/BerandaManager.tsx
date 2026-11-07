import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COAGULANT_TYPES, ROLE_LABEL, formatNumber, isNoFlow, isOutOfLimit, m3sToLs, type Threshold } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { usePond } from '../pond/PondContext';
import { PondsUnavailable } from '../pond/PondsUnavailable';
import { ScreenHeader } from '../ui/ScreenHeader';
import { PondPicker } from '../ui/PondPicker';
import { Segmented } from '../ui/Segmented';
import { Badge } from '../ui/Badge';
import { PhChart } from '../components/PhChart';
import { TrendChart } from '../components/TrendChart';
import { PeriodSummary } from '../components/PeriodSummary';
import { RainChart } from '../components/RainChart';
import { CalendarOverview } from '../components/CalendarOverview';
import { StockBars } from '../components/StockBars';
import { localToday } from './input/DayScope';

type Days = '7' | '30' | '90';
const dayMonth = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00Z`)).replace('.', '');
const full = (iso: string) => `${dayMonth(iso)} ${iso.slice(0, 4)}`;

function Kpi({ label, value, unit, sub, tone }: { label: string; value: number | null; unit?: string; sub?: string; tone?: 'abnormal' | 'normal' | 'noflow' | null }) {
  return (
    <div className="ui-card ui-kpi" role="group" aria-label={label}>
      <span className="ui-kpi__label">{label}</span>
      {value === null
        ? <strong className="is-empty">Belum diisi</strong>
        : <strong className={tone === 'abnormal' ? 'is-bad' : ''}>{formatNumber(value, 1)}{unit && <small> {unit}</small>}</strong>}
      {tone && <Badge tone={tone === 'abnormal' ? 'danger' : tone === 'noflow' ? 'neutral' : 'success'}>{tone === 'abnormal' ? 'Abnormal' : tone === 'noflow' ? 'No flow' : 'Normal'}</Badge>}
      {sub && <span className="ui-kpi__sub">{sub}</span>}
    </div>
  );
}

const judge = (v: number | null, t: Threshold | undefined): 'abnormal' | 'normal' | null =>
  v === null || !t || (t.min === null && t.max === null) ? null : isOutOfLimit(v, t) ? 'abnormal' : 'normal';

const avgSub = (v: number | null | undefined, days: Days) => (v == null ? undefined : `Rata-rata ${days} hari: ${formatNumber(v, 1)}`);

export function BerandaManager() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { ponds, current, setCurrent, loading } = usePond();
  const [days, setDays] = useState<Days>('7');
  const { data, error } = useDashboard(current, Number(days) as 7 | 30 | 90, localToday());
  const th = data?.thresholds ?? {};
  const t = data?.today ?? null;
  const range = data && data.series.length ? `${dayMonth(data.series[0].date)} s/d ${full(data.series[data.series.length - 1].date)}` : '';
  const flowless = (s: { debit_outlet_m3s?: number | null }) => isNoFlow(s.debit_outlet_m3s);
  const hasPh = !!data?.series.some((s) => s.ph_inlet !== null || s.ph_outlet !== null || flowless(s));
  const hasTss = !!data?.series.some((s) => (s.tss_inlet ?? null) !== null || (s.tss_outlet ?? null) !== null || flowless(s));
  const hasFlow = !!data?.series.some((s) => (s.debit_outlet_m3s ?? null) !== null);
  const hasRain = !!data?.series.some((s) => (s.rainfall_mm ?? null) !== null);

  return (
    <>
      <ScreenHeader title="Dashboard" subtitle={`${user ? ROLE_LABEL[user.role] : ''}${range ? ` - ${range}` : ''}`} onProfile={() => nav('/akun')} />
      <div className="ui-page ui-page--wide">
        {!loading && ponds.length === 0 ? <PondsUnavailable /> : (
          <>
            <PondPicker ponds={ponds} value={current} onChange={setCurrent} label="Settling Pond" />
            <Segmented label="Rentang waktu" options={[{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }]} value={days} onChange={setDays} />
            {error && <p className="ui-error" role="alert">{error}</p>}
            {!data && !error && <p className="ui-muted">Memuat…</p>}
            {data && (
              <>
                {t ? (
                  <div className="ui-kpis">
                    <Kpi label="pH Outlet hari ini" value={t.ph_outlet} tone={isNoFlow(t.debit_outlet_m3s) ? 'noflow' : judge(t.ph_outlet, th.ph_outlet)} sub={avgSub(data.summary?.current.avg_ph_outlet, days)} />
                    <Kpi label="TSS Outlet" value={t.tss_outlet} unit="mg/L" tone={isNoFlow(t.debit_outlet_m3s) ? 'noflow' : judge(t.tss_outlet, th.tss_outlet)} sub={avgSub(data.summary?.current.avg_tss_outlet, days)} />
                    <Kpi label="Debit outlet" value={t.debit_outlet_ls} unit="L/s" />
                    <Kpi label="Curah hujan" value={t.rainfall_mm} unit="mm" sub={t.rain_hours === null ? undefined : `${formatNumber(t.rain_hours)} jam hujan`} />
                  </div>
                ) : (
                  <section className="ui-card"><p className="ui-muted">Belum ada data hari ini.</p></section>
                )}
                {data.summary && <PeriodSummary days={Number(days)} current={data.summary.current} previous={data.summary.previous} />}
                <div className="ui-dash-grid">
                  <section className="ui-card">
                    <h2>pH Inlet vs Outlet</h2>
                    {hasPh ? <PhChart series={data.series.map((s) => ({ ...s, ph_outlet: flowless(s) ? 0 : s.ph_outlet, noFlow: flowless(s) }))} band={th.ph_outlet} /> : <p className="ui-muted">Belum ada data pH pada rentang ini.</p>}
                  </section>
                  <section className="ui-card">
                    <h2>TSS Inlet vs Outlet</h2>
                    {hasTss
                      ? <TrendChart name="TSS" unit="mg/L" floorZero limit={th.tss_outlet} series={data.series.map((s) => ({ date: s.date, inlet: s.tss_inlet ?? null, outlet: flowless(s) ? 0 : s.tss_outlet ?? null, noFlow: flowless(s) }))} />
                      : <p className="ui-muted">Belum ada data TSS pada rentang ini.</p>}
                  </section>
                  <section className="ui-card">
                    <h2>Debit outlet (L/s)</h2>
                    {hasFlow
                      ? <TrendChart name="Debit" hide="inlet" outletLabel="Debit outlet (L/s)" floorZero limit={undefined} series={data.series.map((s) => ({ date: s.date, inlet: null, outlet: s.debit_outlet_m3s == null ? null : m3sToLs(s.debit_outlet_m3s), noFlow: flowless(s) }))} />
                      : <p className="ui-muted">Belum ada data debit pada rentang ini.</p>}
                  </section>
                  <section className="ui-card">
                    <h2>Curah hujan (mm)</h2>
                    {hasRain
                      ? <RainChart series={data.series.map((s) => ({ date: s.date, value: s.rainfall_mm ?? null }))} />
                      : <p className="ui-muted">Belum ada data curah hujan pada rentang ini.</p>}
                  </section>
                  <section className="ui-card">
                    <h2>Sisa stok koagulan (kg)</h2>
                    <StockBars items={COAGULANT_TYPES.map((c) => ({ type: c, ...data.coagulant[c] }))} />
                  </section>
                  <div className="ui-dash-grid__wide"><CalendarOverview /></div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
