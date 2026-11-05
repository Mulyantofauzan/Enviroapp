import { Link, useNavigate } from 'react-router-dom';
import { COAGULANT_TYPES, formatDateId } from '@evo/shared';
import { Icon, type IconName } from '../icons';
import { useDay } from '../hooks/useDay';
import { usePond } from '../pond/PondContext';
import { PondsUnavailable } from '../pond/PondsUnavailable';
import { ScreenHeader } from '../ui/ScreenHeader';
import { PondPicker, pondLabel } from '../ui/PondPicker';
import { Badge } from '../ui/Badge';
import { localToday } from './input/DayScope';

export function InputHub() {
  const nav = useNavigate();
  const { ponds, current, setCurrent, loading } = usePond();
  const today = localToday();
  const { data, error } = useDay(today, current);
  const pond = ponds.find((p) => p.id === current);

  const coagCount = data ? COAGULANT_TYPES.filter((t) => data.coagulant[t]).length : 0;
  const airStatus = !data ? null : !data.water && coagCount === 0 ? 'Belum diisi' : data.water && coagCount === 3 ? 'Sudah diisi' : `Air ${data.water ? 'sudah' : 'belum'}, koagulan ${coagCount} dari 3`;
  const rows: { to: string; icon: IconName; tone: string; title: string; status: string | null; done: boolean }[] = [
    { to: '/input/cuaca', icon: 'cloud-rain', tone: 'water', title: 'Cuaca', status: data ? (data.weather ? 'Sudah diisi' : 'Belum diisi') : null, done: !!data?.weather },
    { to: '/input/air', icon: 'droplet', tone: 'primary', title: 'Air & Koagulan', status: airStatus, done: !!data?.water && coagCount === 3 },
  ];

  return (
    <>
      <ScreenHeader title="Input" subtitle={`${pond ? pondLabel(pond) : 'Pilih pond'} - ${formatDateId(today)}`} onProfile={() => nav('/akun')} />
      <div className="ui-page">
        {!loading && ponds.length === 0 ? <PondsUnavailable /> : (
          <>
            <section className="ui-card"><PondPicker ponds={ponds} value={current} onChange={setCurrent} /></section>
            {error && <p className="ui-error" role="alert">{error}</p>}
            <section className="ui-card ui-rows" aria-label="Modul input">
              {rows.map((r) => (
                <Link key={r.to} to={r.to} className="ui-row">
                  <span className={`ui-bubble ui-bubble--${r.tone}`}><Icon name={r.icon} /></span>
                  <strong>{r.title}</strong>
                  {r.status && <Badge tone={r.done ? 'success' : 'neutral'}>{r.status}</Badge>}
                  <Icon name="chevron-right" size={18} />
                </Link>
              ))}
            </section>
          </>
        )}
      </div>
    </>
  );
}
