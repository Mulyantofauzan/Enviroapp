import { Icon } from '../icons';
import { monthRange } from '../lib/dates';
import type { Mark } from '../lib/marks';

const NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const monthName = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'long' }).format(new Date(`${iso}T00:00:00Z`));

type Props = {
  month: string; today: string; marks: Record<string, Mark>;
  selected?: string; onSelect?: (iso: string) => void; onPrev?: () => void; onNext?: () => void;
};

/** A whole month, Monday first. With no onSelect it is a read-only overview. */
export function MonthGrid({ month, today, marks, selected, onSelect, onPrev, onNext }: Props) {
  const [first, last] = monthRange(month);
  const count = Number(last.slice(8));
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const mname = monthName(first);
  return (
    <section className="ui-card ui-month" aria-label={`Kalender ${mname} ${month.slice(0, 4)}`}>
      <div className="ui-month__head">
        {onPrev ? <button type="button" className="ui-iconbtn" aria-label="Bulan sebelumnya" onClick={onPrev}><Icon name="chevron-left" /></button> : <span />}
        <strong>{mname} {month.slice(0, 4)}</strong>
        {onNext ? <button type="button" className="ui-iconbtn" aria-label="Bulan berikutnya" onClick={onNext}><Icon name="chevron-right" /></button> : <span />}
      </div>
      <div className="ui-month__grid">
        {NAMES.map((n) => <span key={n} data-testid="weekday" className="ui-month__wd">{n}</span>)}
        {Array.from({ length: count }, (_, i) => {
          const iso = `${month}-${String(i + 1).padStart(2, '0')}`;
          const mark = marks[iso];
          const words = mark ? (mark === 'overdue' ? 'ada overdue' : 'terjadwal') : '';
          const cls = `ui-mday${iso === selected ? ' is-on' : ''}${iso === today ? ' is-today' : ''}`;
          const style = { gridColumnStart: ((offset + i) % 7) + 1 };
          const inner = (<><b>{i + 1}</b><i className={`ui-day__dot${mark ? ` is-${mark}` : ''}`} /></>);
          return onSelect ? (
            <button key={iso} type="button" style={style} data-testid={`day-${iso}`} data-mark={mark} className={cls}
              aria-label={`${i + 1} ${mname}${words ? `, ${words}` : ''}`} aria-pressed={iso === selected} aria-current={iso === today ? 'date' : undefined}
              onClick={() => onSelect(iso)}>{inner}</button>
          ) : (
            <div key={iso} style={style} data-testid={`day-${iso}`} data-mark={mark} className={cls} aria-current={iso === today ? 'date' : undefined}>
              {inner}{words && <span className="ui-sr">, {words}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
