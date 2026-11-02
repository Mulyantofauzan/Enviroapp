import { Icon } from '../icons';
import { addDays, dayMonth, dayOfMonth } from '../lib/dates';

const NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
export type Mark = 'overdue' | 'scheduled';

type Props = {
  weekStart: string; selected: string; today: string;
  marks: Record<string, Mark>;
  onSelect: (iso: string) => void; onPrev: () => void; onNext: () => void;
};

export function WeekStrip({ weekStart, selected, today, marks, onSelect, onPrev, onNext }: Props) {
  const days = NAMES.map((n, i) => ({ n, iso: addDays(weekStart, i) }));
  const end = days[6].iso;
  return (
    <section className="ui-card ui-week" aria-label="Minggu">
      <div className="ui-week__head">
        <button type="button" className="ui-iconbtn" aria-label="Minggu sebelumnya" onClick={onPrev}><Icon name="chevron-left" /></button>
        <strong>{dayMonth(weekStart)} s/d {dayMonth(end)} {end.slice(0, 4)}</strong>
        <button type="button" className="ui-iconbtn" aria-label="Minggu berikutnya" onClick={onNext}><Icon name="chevron-right" /></button>
      </div>
      <div className="ui-week__days">
        {days.map(({ n, iso }) => {
          const mark = marks[iso];
          const label = `${n} ${dayOfMonth(iso)}${mark ? `, ${mark === 'overdue' ? 'ada overdue' : 'terjadwal'}` : ''}`;
          return (
            <button key={iso} type="button" aria-label={label} aria-pressed={iso === selected} aria-current={iso === today ? 'date' : undefined}
              data-mark={mark} className={`ui-day${iso === selected ? ' is-on' : ''}${iso === today ? ' is-today' : ''}`} onClick={() => onSelect(iso)}>
              <span>{n}</span>
              <b>{dayOfMonth(iso)}</b>
              <i className={`ui-day__dot${mark ? ` is-${mark}` : ''}`} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
