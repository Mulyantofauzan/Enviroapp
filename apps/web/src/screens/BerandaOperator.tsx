import { Link, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, formatDateId, formatNumber, isOutOfLimit, type Threshold } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { Icon, type IconName } from '../icons';
import { useDay } from '../hooks/useDay';
import { usePond } from '../pond/PondContext';
import { ScreenHeader } from '../ui/ScreenHeader';
import { PondPicker, pondLabel } from '../ui/PondPicker';
import { Badge } from '../ui/Badge';

import { localToday } from './input/DayScope';

const TILES: { to: string; icon: IconName; tone: string; title: string; sub: string }[] = [
  { to: '/input/cuaca', icon: 'cloud-rain', tone: 'water', title: 'Cuaca', sub: 'Hujan & jam hujan' },
  { to: '/input/air', icon: 'droplet', tone: 'primary', title: 'Air Permukaan', sub: 'pH, TSS, debit' },
  { to: '/input/koagulan', icon: 'flask', tone: 'warning', title: 'Koagulan', sub: 'Kapur & tawas' },
];

function verdict(v: number | null, t: Threshold | undefined): 'abnormal' | 'normal' | null {
  if (v === null || !t || (t.min === null && t.max === null)) return null;
  return isOutOfLimit(v, t) ? 'abnormal' : 'normal';
}

function Stat({ label, value, unit, verdict: vd }: { label: string; value: number | null; unit?: string; verdict: 'abnormal' | 'normal' | null }) {
  return (
    <div className="ui-stat">
      <span className="ui-stat__label">{label}</span>
      {value === null
        ? <strong className="is-empty">Belum diisi</strong>
        : <strong className={vd === 'abnormal' ? 'is-bad' : ''}>{formatNumber(value, 1)}{unit && <small> {unit}</small>}</strong>}
      {vd && <Badge tone={vd === 'abnormal' ? 'danger' : 'success'}>{vd === 'abnormal' ? 'Abnormal' : 'Normal'}</Badge>}
    </div>
  );
}

export function BerandaOperator() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { ponds, current, setCurrent, loading } = usePond();
  const today = localToday();
  const { data, error } = useDay(today, current);
  const pond = ponds.find((p) => p.id === current);
  if (!user) return null;

  const w = data?.water ?? null;
  const th = pond?.thresholds ?? {};
  return (
    <>
      <ScreenHeader title={`Halo, ${user.name.split(' ')[0]}`} subtitle={`${ROLE_LABEL[user.role]} - ${formatDateId(today)}`} onProfile={() => nav('/akun')} />
      <div className="ui-page">
        {!loading && ponds.length === 0 ? (
          <section className="ui-card">
            <p className="ui-muted">Belum ada settling pond aktif. Minta admin menambahkannya di menu Master.</p>
            {user.role === 'Admin' && <Link to="/master" className="ui-link">Buka Master</Link>}
          </section>
        ) : (
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
            </div>
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
                  <Stat label="pH Outlet" value={w.ph_outlet} verdict={verdict(w.ph_outlet, th.ph_outlet)} />
                  <Stat label="TSS Outlet" value={w.tss_outlet} unit="mg/L" verdict={verdict(w.tss_outlet, th.tss_outlet)} />
                  <Stat label="Debit harian" value={(w as any).debit_outlet_m3d ?? null} unit="m³/d" verdict={null} />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

