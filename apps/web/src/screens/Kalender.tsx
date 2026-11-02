import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EVENT_FREQUENCIES, FREQUENCY_LABEL, canWrite, formatDateId, type EventFrequency } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { useEventSummary } from '../hooks/useEventSummary';
import { useOverdue, useWeekEvents } from '../hooks/useEvents';
import { addDays, mondayOf } from '../lib/dates';
import { usePond } from '../pond/PondContext';
import { EventCard } from '../components/EventCard';
import { WeekStrip, type Mark } from '../components/WeekStrip';
import { ScreenHeader } from '../ui/ScreenHeader';
import { pondLabel } from '../ui/PondPicker';
import { localToday } from './input/DayScope';

export function Kalender() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { ponds } = usePond();
  const { summary, error: summaryError } = useEventSummary();
  const today = summary?.today ?? (summaryError ? localToday() : null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<EventFrequency | ''>('');

  useEffect(() => {
    if (today && !weekStart) { setWeekStart(mondayOf(today)); setSelected(today); }
  }, [today, weekStart]);

  const weekEnd = weekStart ? addDays(weekStart, 6) : null;
  const week = useWeekEvents(weekStart, weekEnd, frequency);
  const overdue = useOverdue(frequency);
  const pondName = useMemo(() => new Map(ponds.map((p) => [p.id, pondLabel(p)])), [ponds]);

  const marks = useMemo(() => {
    const m: Record<string, Mark> = {};
    for (const e of week.data ?? []) {
      if (e.status === 'overdue') m[e.due_date] = 'overdue';
      else if (!m[e.due_date]) m[e.due_date] = 'scheduled';
    }
    return m;
  }, [week.data]);

  const canAct = !!user && canWrite(user.role);
  const canSchedule = user?.role === 'Manager' || user?.role === 'Admin';
  const error = week.error || overdue.error;
  const dayEvents = (week.data ?? []).filter((e) => e.due_date === selected);
  const dayShown = dayEvents.filter((e) => e.status !== 'overdue');
  const month = selected ? new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${selected}T00:00:00Z`)) : '';

  return (
    <>
      <ScreenHeader title="Kalender" subtitle={month ? `Enviro Events - ${month}` : 'Enviro Events'} onProfile={() => nav('/akun')} />
      <div className="ui-page ui-page--wide">
        {canSchedule && <Link to="/kalender/jadwal" className="ui-btn ui-btn--outline">Atur jadwal</Link>}
        {error && <p className="ui-error" role="alert">{error}</p>}
        {!weekStart || !today || !selected ? (
          !error && <p className="ui-muted">Memuat…</p>
        ) : (
          <div className="ui-cal">
            <div className="ui-cal__side">
            <WeekStrip weekStart={weekStart} selected={selected} today={today} marks={marks}
              onSelect={setSelected} onPrev={() => setWeekStart(addDays(weekStart, -7))} onNext={() => setWeekStart(addDays(weekStart, 7))} />
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
                  <EventCard key={`${e.schedule_id}|${e.due_date}`} event={e} canAct={canAct} pondName={e.sp_id ? pondName.get(e.sp_id) : undefined} />
                ))}
              </section>
            )}

            <section className="ui-stack" aria-label="Event pada tanggal terpilih">
              <h2>{formatDateId(selected)}</h2>
              {!week.data && !error && <p className="ui-muted">Memuat…</p>}
              {week.data && dayEvents.length === 0 && <p className="ui-muted">Tidak ada event pada tanggal ini.</p>}
              {dayShown.map((e) => (
                <EventCard key={`${e.schedule_id}|${e.due_date}`} event={e} canAct={canAct} pondName={e.sp_id ? pondName.get(e.sp_id) : undefined} />
              ))}
            </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
