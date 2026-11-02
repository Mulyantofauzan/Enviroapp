import { Link } from 'react-router-dom';
import { useEventSummary } from '../hooks/useEventSummary';
import { useRangeEvents } from '../hooks/useEvents';
import { monthRange } from '../lib/dates';
import { marksOf } from '../lib/marks';
import { MonthGrid } from './MonthGrid';

/** This month at a glance for Manager and Admin. A failing summary hides the card; it never breaks the dashboard. */
export function CalendarOverview() {
  const { summary } = useEventSummary();
  const month = summary?.today.slice(0, 7) ?? null;
  const [from, to] = month ? monthRange(month) : [null, null];
  const { data } = useRangeEvents(from, to, '');
  if (!summary || !month) return null;
  return (
    <section className="ui-card" aria-label="Kalender bulan ini">
      <h2>Kalender bulan ini</h2>
      <div className="ui-calov">
        <MonthGrid month={month} today={summary.today} marks={marksOf(data ?? [])} />
        <div className="ui-calov__info">
          <p className={summary.overdue > 0 ? 'ui-calov__bad' : ''}><strong>{summary.overdue} event overdue</strong></p>
          <p>{summary.due_today} event hari ini</p>
          <Link to="/kalender" className="ui-btn ui-btn--outline">Buka Kalender</Link>
        </div>
      </div>
    </section>
  );
}
