import { Icon } from '../icons';
import { monthRange } from '../lib/dates';
import { compareMarks, type DayMark } from '../lib/marks';

const NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const monthName = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'long' }).format(new Date(`${iso}T00:00:00Z`));

const MAX_DOTS = 8;

/** Each category that appears on some day of this month, once, in calendar order. */
function categoriesOfMonth(marks: Record<string, DayMark[]>, month: string): DayMark[] {
  const all = new Map<string, DayMark>();
  for (const [date, list] of Object.entries(marks)) if (date.startsWith(month)) for (const m of list) all.set(m.key, m);
  return [...all.values()].sort(compareMarks);
}

/** Dots spread evenly on a circle round the date number, the first at the top. Past eight, seven dots and a "more" dot. */
function ring(marks: DayMark[]) {
  if (marks.length === 0) return null;
  const more = marks.length > MAX_DOTS;
  const shown: (DayMark | null)[] = more ? [...marks.slice(0, MAX_DOTS - 1), null] : marks;
  return (
    <span className="ui-ring" aria-hidden="true">
      {shown.map((m, i) => {
        const angle = Math.round((-90 + (i * 360) / shown.length) * 100) / 100;
        const style = { '--a': `${angle}deg`, ...(m ? { '--bg': m.color } : {}) } as React.CSSProperties;
        return <i key={m?.key ?? 'more'} className={`ui-dot${m ? '' : ' is-more'}`} style={style} />;
      })}
    </span>
  );
}

type Props = {
  month: string; today: string; marks: Record<string, DayMark[]>;
  selected?: string; onSelect?: (iso: string) => void; onPrev?: () => void; onNext?: () => void;
};

/** A whole month, Monday first. With no onSelect it is a read-only overview. */
export function MonthGrid({ month, today, marks, selected, onSelect, onPrev, onNext }: Props) {
  const [first, last] = monthRange(month);
  const count = Number(last.slice(8));
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const mname = monthName(first);
  const legend = categoriesOfMonth(marks, month);
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
          const day = marks[iso] ?? [];
          const words = day.map((m) => m.name).join(', ');
          const dataMarks = day.length ? day.map((m) => m.key).join(' ') : undefined;
          const cls = `ui-mday${iso === selected ? ' is-on' : ''}${iso === today ? ' is-today' : ''}`;
          const style = { gridColumnStart: ((offset + i) % 7) + 1 };
          const inner = (<><b>{i + 1}</b>{ring(day)}</>);
          return onSelect ? (
            <button key={iso} type="button" style={style} data-testid={`day-${iso}`} data-marks={dataMarks} className={cls}
              aria-label={`${i + 1} ${mname}${words ? `, ${words}` : ''}`} aria-pressed={iso === selected} aria-current={iso === today ? 'date' : undefined}
              onClick={() => onSelect(iso)}>{inner}</button>
          ) : (
            <div key={iso} style={style} data-testid={`day-${iso}`} data-marks={dataMarks} className={cls} aria-current={iso === today ? 'date' : undefined}>
              {inner}{words && <span className="ui-sr">, {words}</span>}
            </div>
          );
        })}
      </div>
      {legend.length > 0 && (
        <ul className="ui-legend ui-month__legend" aria-label="Kategori">
          {legend.map((m) => <li key={m.key}><i className="ui-dot" style={{ '--bg': m.color } as React.CSSProperties} />{m.name}</li>)}
        </ul>
      )}
    </section>
  );
}
