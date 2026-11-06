import { Link } from 'react-router-dom';
import { FREQUENCY_LABEL, type EventOccurrence } from '@evo/shared';
import { dayMonth } from '../lib/dates';
import { Badge } from '../ui/Badge';

export function StatusBadge({ e }: { e: EventOccurrence }) {
  if (e.status === 'overdue') return <Badge tone="danger-solid">Overdue</Badge>;
  if (e.status === 'today') return <Badge tone="water">Hari ini</Badge>;
  if (e.status === 'done') return e.late ? <Badge tone="warning">Selesai terlambat</Badge> : <Badge tone="success">Selesai</Badge>;
  return <Badge tone="water">{dayMonth(e.due_date)}</Badge>;
}

export function EventCard({ event: e, canAct }: { event: EventOccurrence; canAct: boolean }) {
  const to = `/kalender/${e.schedule_id}/${e.due_date}`;
  const meta = [FREQUENCY_LABEL[e.frequency], `tenggat ${dayMonth(e.due_date)}`].filter(Boolean).join(' - ');
  return (
    <article className={`ui-ev ui-ev--${e.status}`} aria-label={e.title}>
      <div className="ui-ev__head">
        <Link to={to}>{e.title}</Link>
        <StatusBadge e={e} />
      </div>
      {e.category_name && (
        <p className="ui-ev__cat"><i className="ui-dot" style={{ '--bg': e.category_color ?? undefined } as React.CSSProperties} />{e.category_name}</p>
      )}
      <p className="ui-ev__meta">{meta}</p>
      {e.status === 'overdue' && canAct && <Link to={to} className="ui-btn ui-btn--danger ui-ev__act">Unggah eviden</Link>}
    </article>
  );
}
