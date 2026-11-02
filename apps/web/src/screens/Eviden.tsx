import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABEL, formatDateId } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { useEventSummary } from '../hooks/useEventSummary';
import { useEvidenceList, type EvidenceRow } from '../hooks/useEvidenceList';
import { addDays } from '../lib/dates';
import { witaStamp } from '../lib/stamp';
import { usePond } from '../pond/PondContext';
import { EvidenceMeta } from '../components/EvidenceMeta';
import { EvidenceViewer } from '../components/EvidenceViewer';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Segmented } from '../ui/Segmented';
import { pondLabel } from '../ui/PondPicker';
import { api } from '../api/client';
import { localToday } from './input/DayScope';
import { useEffect } from 'react';

const SPANS = [{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }] as const;
type Span = (typeof SPANS)[number]['value'];
const PREVIEW = ['image/jpeg', 'image/png', 'image/webp'];

export function Eviden() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { ponds, current, loading: pondsLoading } = usePond();
  const { summary, error: summaryError } = useEventSummary();
  const today = summary?.today ?? (summaryError ? localToday() : null);
  const [span, setSpan] = useState<Span>('30');
  const [schedule, setSchedule] = useState('');
  const [titles, setTitles] = useState<{ id: string; title: string }[]>([]);
  const [viewing, setViewing] = useState<{ item: EvidenceRow; opener: HTMLElement | null } | null>(null);

  useEffect(() => {
    let live = true;
    api<{ id: string; title: string }[]>('/schedules?all=1').then((s) => live && setTitles(Array.isArray(s) ? s : [])).catch(() => { /* chips are optional */ });
    return () => { live = false; };
  }, []);

  const from = today ? addDays(today, -(Number(span) - 1)) : null;
  const list = useEvidenceList({ from, to: today, schedule, sp: current, ready: !!today && !pondsLoading });
  const pond = useMemo(() => ponds.find((p) => p.id === current), [ponds, current]);
  const readOnly = user?.role === 'Auditor';

  function closeViewer() { viewing?.opener?.focus(); setViewing(null); }

  return (
    <>
      <ScreenHeader title="Eviden Lapangan" subtitle={user ? `${ROLE_LABEL[user.role]}${pond ? ` - ${pondLabel(pond)}` : ''}` : undefined} onProfile={() => nav('/akun')} />
      <div className="ui-page ui-page--wide">
        {readOnly && <div><Badge tone="neutral">Hanya baca</Badge></div>}
        <div className="ui-chips" role="tablist" aria-label="Jadwal">
          <button type="button" role="tab" aria-selected={schedule === ''} className={schedule === '' ? 'is-on' : ''} onClick={() => setSchedule('')}>Semua</button>
          {titles.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={schedule === t.id} className={schedule === t.id ? 'is-on' : ''} onClick={() => setSchedule(t.id)}>{t.title}</button>
          ))}
        </div>
        <Segmented label="Rentang" options={[...SPANS]} value={span} onChange={setSpan} />
        {list.error && <p className="ui-error" role="alert">{list.error}</p>}
        {list.loading ? (
          !list.error && <p className="ui-muted">Memuat…</p>
        ) : list.items.length === 0 ? (
          !list.error && <p className="ui-muted">Belum ada eviden pada rentang ini.</p>
        ) : (
          <ul className="ui-evgrid">
            {list.items.map((x) => (
              <li key={x.id} className="ui-card ui-evcard">
                {PREVIEW.includes(x.mime)
                  ? <img src={`/api/evidence/${x.id}/file`} alt={x.filename} loading="lazy" />
                  : <div className="ui-evcard__doc"><Icon name="file" size={28} /><span>{x.filename}</span></div>}
                <h2>{x.title}</h2>
                <p className="ui-muted">{formatDateId(x.due_date!)} - {witaStamp(new Date(x.uploaded_at))} WITA</p>
                <p>{x.uploaded_by_name}{x.uploaded_by_role ? ` - ${x.uploaded_by_role}` : ''}</p>
                <EvidenceMeta e={x} />
                <div className="ui-evcard__acts">
                  {PREVIEW.includes(x.mime) && (
                    <Button variant="outline" onClick={(ev) => setViewing({ item: x, opener: ev.currentTarget })}>Pratinjau</Button>
                  )}
                  <a className="ui-btn ui-btn--outline" href={`/api/evidence/${x.id}/file`} download={x.filename}><Icon name="download" /> Unduh</a>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!list.loading && list.total > list.items.length && <Button variant="outline" onClick={list.more}>Muat lebih banyak</Button>}
      </div>
      {viewing && <EvidenceViewer item={viewing.item} onClose={closeViewer} />}
    </>
  );
}
