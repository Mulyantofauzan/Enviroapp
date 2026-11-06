import { Link, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, formatDateId, formatNumber, isNoFlow, isOutOfLimit, m3sToLs, type Threshold } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { Icon, type IconName } from '../icons';
import { useDay } from '../hooks/useDay';
import { useEventSummary } from '../hooks/useEventSummary';
import { Banner } from '../ui/Banner';
import { usePond } from '../pond/PondContext';
import { PondsUnavailable } from '../pond/PondsUnavailable';
import { ScreenHeader } from '../ui/ScreenHeader';
import { PondPicker, pondLabel } from '../ui/PondPicker';
import { Badge } from '../ui/Badge';

import { localToday } from './input/DayScope';

const TILES: { to: string; icon: IconName; tone: string; title: string; sub: string }[] = [
  { to: '/input/cuaca', icon: 'cloud-rain', tone: 'water', title: 'Cuaca', sub: 'Hujan & jam hujan' },
  { to: '/input/air', icon: 'droplet', tone: 'primary', title: 'Air & Koagulan', sub: 'pH, TSS, debit, tawas' },
];

const eventSub = (n: number | undefined) => (n === undefined ? 'Jadwal dan eviden' : n > 0 ? `${n} event overdue` : 'Tidak ada yang telat');

function verdict(v: number | null, t: Threshold | undefined): 'abnormal' | 'normal' | null {
  if (v === null || !t || (t.min === null && t.max === null)) return null;
  return isOutOfLimit(v, t) ? 'abnormal' : 'normal';
}

function Stat({ label, value, unit, verdict: vd }: { label: string; value: number | null; unit?: string; verdict: 'abnormal' | 'normal' | 'noflow' | null }) {
  return (
    <div className="ui-stat">
      <span className="ui-stat__label">{label}</span>
      {value === null
        ? <strong className="is-empty">Belum diisi</strong>
        : <strong className={vd === 'abnormal' ? 'is-bad' : ''}>{formatNumber(value, 1)}{unit && <small> {unit}</small>}</strong>}
      {vd && <Badge tone={vd === 'abnormal' ? 'danger' : vd === 'noflow' ? 'neutral' : 'success'}>{vd === 'abnormal' ? 'Abnormal' : vd === 'noflow' ? 'No flow' : 'Normal'}</Badge>}
    </div>
  );
}

export function BerandaOperator() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { ponds, current, setCurrent, loading } = usePond();
  const today = localToday();
  const { data, error } = useDay(today, current);
  const { summary } = useEventSummary();
  const pond = ponds.find((p) => p.id === current);
  if (!user) return null;

  const w = data?.water ?? null;
  const th = pond?.thresholds ?? {};
  return (
    <>
      <ScreenHeader title={`Halo, ${user.name.split(' ')[0]}`} subtitle={`${ROLE_LABEL[user.role]} - ${formatDateId(today)}`} onProfile={() => nav('/akun')} />
      <div className="ui-page ui-page--wide">
        {!loading && ponds.length === 0 ? <PondsUnavailable /> : (
          <>
            <section className="ui-card"><PondPicker ponds={ponds} value={current} onChange={setCurrent} label="Settling Pond aktif" /></section>
            <div className="ui-tiles">
              {TILES.map((t) => (
                <Link key={t.to} to={t.to} className="ui-card ui-tile">
                  <span className={`ui-bubble ui-bubble--${t.tone}`}><Icon name={t.icon} /></span>
                  <strong>{t.title}</strong>
                  <small>{t.sub}</small>
                </Link>
              ))}
              <Link to="/kalender" className="ui-card ui-tile">
                <span className={`ui-bubble ui-bubble--${summary && summary.overdue > 0 ? 'danger' : 'primary'}`}><Icon name="calendar" /></span>
                <strong>Event Enviro</strong>
                <small>{eventSub(summary?.overdue)}</small>
              </Link>
            </div>
            {summary && summary.overdue > 0 && (
              <Link to="/kalender" className="ui-linkblock" aria-label={`${summary.overdue} event overdue`}>
                <Banner tone="danger" title={`${summary.overdue} event overdue`}>Unggah eviden untuk menyelesaikannya</Banner>
              </Link>
            )}
            <section className="ui-card" aria-label={`Data hari ini - ${pond ? pondLabel(pond) : ''}`}>
              <h2>Data hari ini - {pond?.code ?? pond?.name}</h2>
              {error && <p className="ui-error" role="alert">{error}</p>}
              {!data && !error && <p className="ui-muted">Memuat…</p>}
              {data && !w && (
                <div className="ui-empty">
                  <p>Belum ada data air hari ini.</p>
                  <Link to="/input/air" className="ui-btn ui-btn--outline">Isi data air</Link>
                </div>
              )}
              {w && (
                <div className="ui-stats">
                  <Stat label="pH Outlet" value={w.ph_outlet} verdict={isNoFlow(w.debit_outlet_m3s) ? 'noflow' : verdict(w.ph_outlet, th.ph_outlet)} />
                  <Stat label="TSS Outlet" value={w.tss_outlet} unit="mg/L" verdict={isNoFlow(w.debit_outlet_m3s) ? 'noflow' : verdict(w.tss_outlet, th.tss_outlet)} />
                  <Stat label="Debit outlet" value={w.debit_outlet_m3s === null ? null : m3sToLs(w.debit_outlet_m3s)} unit="L/s" verdict={null} />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

