import { Fragment, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { canWrite, formatDateId, type Threshold } from '@evo/shared';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../../icons';
import { useDay, type DayData } from '../../hooks/useDay';
import { usePond, type Pond } from '../../pond/PondContext';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { PondPicker, pondLabel } from '../../ui/PondPicker';
import { Banner } from '../../ui/Banner';

export const localToday = () => new Date().toLocaleDateString('en-CA');

export type DayCtx = {
  date: string; sp: string; data: DayData; pond: Pond | undefined; thresholds: Record<string, Threshold>;
  canEdit: boolean; reload: () => void;
};

/**
 * Header, date and pond pickers, and loading of one day. The form below is keyed on date, pond and load,
 * and is not rendered while loading or after an error, so numbers from another day or pond never carry over.
 */
export function DayScope({ title, children, perPond = true }: { title: string; children: (c: DayCtx) => ReactNode; perPond?: boolean }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const { ponds, current, setCurrent, loading: pondsLoading } = usePond();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || localToday();
  // Day-level data (weather) has no pond of its own. The day is still read through some pond, so use the first active one.
  const sp = perPond ? params.get('sp') || current : current || ponds.find((p) => p.is_active)?.id || ponds[0]?.id || '';
  const pond = ponds.find((p) => p.id === sp);
  const { data, error, reload, version } = useDay(date, sp);
  const setQuery = (patch: Record<string, string>) => setParams({ date, ...(sp ? { sp } : {}), ...patch }, { replace: true });
  const pondActive = !perPond || !!pond;

  return (
    <>
      <ScreenHeader title={title} subtitle={perPond ? `${pond ? pondLabel(pond) : 'Pilih pond'} - ${formatDateId(date)}` : formatDateId(date)} onProfile={() => nav('/akun')} />
      <div className="ui-page">
        <section className="ui-card ui-pickers" aria-label={perPond ? 'Tanggal dan pond' : 'Tanggal'}>
          <label className="ui-date">
            <span>Tanggal pencatatan</span>
            <span className="ui-date__box">
              <Icon name="calendar" />
              <input type="date" value={date} onChange={(e) => e.target.value && setQuery({ date: e.target.value })} />
            </span>
          </label>
          {perPond && <PondPicker ponds={ponds} value={sp} onChange={(id) => { setCurrent(id); setQuery({ sp: id }); }} />}
        </section>

        {perPond && !pondsLoading && !pondActive && (
          <Banner tone="info" title="Settling pond ini nonaktif">Anda bisa melihat hari ini tapi tidak bisa mengubahnya.</Banner>
        )}
        {error && <p className="ui-error" role="alert">{error}</p>}
        {!data && !error && sp && <p className="ui-muted">Memuat data hari ini…</p>}
        {data && sp && (
          <Fragment key={`${date}|${sp}|${version}`}>
            {children({ date, sp, data, pond, thresholds: pond?.thresholds ?? {}, canEdit: !!user && canWrite(user.role) && pondActive, reload })}
          </Fragment>
        )}
      </div>
    </>
  );
}
