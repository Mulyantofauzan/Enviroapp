import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EVENT_FREQUENCIES, FREQUENCY_LABEL, canWrite, formatDateId, type EventFrequency } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { useEventSummary } from '../hooks/useEventSummary';
import { useOverdue, useRangeEvents } from '../hooks/useEvents';
import { addMonths, monthRange } from '../lib/dates';
import { marksOf } from '../lib/marks';
import { EventCard } from '../components/EventCard';
import { MonthGrid } from '../components/MonthGrid';
import { ScreenHeader } from '../ui/ScreenHeader';
import { localToday } from './input/DayScope';

export function Kalender() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { summary, error: summaryError } = useEventSummary();
  const today = summary?.today ?? (summaryError ? localToday() : null);
  const [month, setMonth] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<EventFrequency | ''>('');

  useEffect(() => {
    if (today && !month) { setMonth(today.slice(0, 7)); setSelected(today); }
  }, [today, month]);

  const [from, to] = month ? monthRange(month) : [null, null];
  const monthEvents = useRangeEvents(from, to, frequency);
  const overdue = useOverdue(frequency);
  const marks = useMemo(() => marksOf(monthEvents.data ?? []), [monthEvents.data]);

  function goMonth(n: number) {
    if (!month || !today) return;
    const m = addMonths(month, n);
    setMonth(m);
    setSelected(today.slice(0, 7) === m ? today : `${m}-01`);
  }

  const canAct = !!user && canWrite(user.role);
  const canSchedule = user?.role === 'Manager' || user?.role === 'Admin';
  const error = monthEvents.error || overdue.error;
  const dayEvents = (monthEvents.data ?? []).filter((e) => e.due_date === selected);
  const dayShown = dayEvents.filter((e) => e.status !== 'overdue');
  const title = selected ? new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${selected}T00:00:00Z`)) : '';

  return (
    <>
      <ScreenHeader title="Kalender" subtitle={title ? `Enviro Events - ${title}` : 'Enviro Events'} onProfile={() => nav('/akun')} />
      <div className="ui-page ui-page--wide">
        {canSchedule && <Link to="/kalender/jadwal" className="ui-btn ui-btn--outline">Atur jadwal</Link>}
        {error && <p className="ui-error" role="alert">{error}</p>}
        {!month || !today || !selected ? (
          !error && <p className="ui-muted">Memuat…</p>
        ) : (
          <div className="ui-cal">
            <div className="ui-cal__side">
              <MonthGrid month={month} today={today} selected={selected} marks={marks} onSelect={setSelected} onPrev={() => goMonth(-1)} onNext={() => goMonth(1)} />
              <div className="ui-chips" role="tablist" aria-label="Frekuensi">
                {(['', ...EVENT_FREQUENCIES] as const).map((f) => (
                  <button key={f || 'all'} type="button" role="tab" aria-selected={f === frequency} className={f === frequency ? 'is-on' : ''} onClick={() => setFrequency(f)}>
                    {f === '' ? 'Semua' : FREQUENCY_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>
            <div className="ui-cal__main">
              {overdue.data && overdue.data.events.length > 0 && (
                <section className="ui-stack" aria-label="Overdue">
                  <h2>Overdue</h2>
                  {overdue.data.total > overdue.data.events.length && (
                    <p className="ui-muted">Ada {overdue.data.total} event overdue, {overdue.data.events.length} teratas ditampilkan.</p>
                  )}
                  {overdue.data.events.map((e) => (
                    <EventCard key={`${e.schedule_id}|${e.due_date}`} event={e} canAct={canAct} />
                  ))}
                </section>
              )}

              <section className="ui-stack" aria-label="Event pada tanggal terpilih">
                <h2>{formatDateId(selected)}</h2>
                {!monthEvents.data && !error && <p className="ui-muted">Memuat…</p>}
                {monthEvents.data && dayEvents.length === 0 && <p className="ui-muted">Tidak ada event pada tanggal ini.</p>}
                {dayShown.map((e) => (
                  <EventCard key={`${e.schedule_id}|${e.due_date}`} event={e} canAct={canAct} />
                ))}
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
