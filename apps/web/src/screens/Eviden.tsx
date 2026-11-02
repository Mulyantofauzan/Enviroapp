import { useEffect, useMemo, useState } from 'react';
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
import { buildZip } from '../lib/zip';
import { localToday } from './input/DayScope';

const SPANS = [{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }] as const;
type Span = (typeof SPANS)[number]['value'];
const ZIP_MAX = 100;
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

  const [zip, setZip] = useState<{ done: number; total: number } | null>(null);
  const [zipError, setZipError] = useState('');

  async function downloadAll() {
    if (!from || !today) return;
    setZipError('');
    if (list.total > ZIP_MAX) { setZipError(`Ada ${list.total} eviden. Persempit rentang agar tidak lebih dari ${ZIP_MAX}.`); return; }
    setZip({ done: 0, total: list.total });
    try {
      const q = new URLSearchParams({ from, to: today, limit: String(ZIP_MAX), offset: '0' });
      if (schedule) q.set('schedule', schedule);
      if (current) q.set('sp', current);
      const all = await api<{ total: number; items: EvidenceRow[] }>(`/evidence?${q}`);
      if (all.total > ZIP_MAX) throw new Error(`Ada ${all.total} eviden. Persempit rentang agar tidak lebih dari ${ZIP_MAX}.`);
      const blob = await buildZip(
        all.items.map((x) => ({ id: x.id, due_date: x.due_date!, title: x.title ?? 'eviden', filename: x.filename })),
        async (id) => {
          const r = await fetch(`/api/evidence/${id}/file`);
          if (!r.ok) throw new Error('unduh gagal');
          return new Uint8Array(await r.arrayBuffer());
        },
        (done, total) => setZip({ done, total }),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eviden-${from}-${today}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setZipError((e as Error).message);
    } finally {
      setZip(null);
    }
  }

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
        {zipError && <p className="ui-error" role="alert">{zipError}</p>}
        <Button disabled={!!zip || list.loading || list.items.length === 0} onClick={downloadAll}>
          <Icon name="download" /> {zip ? `Menyiapkan ${zip.done} dari ${zip.total}` : 'Unduh semua eviden (ZIP)'}
        </Button>
        {!list.loading && list.total > list.items.length && <Button variant="outline" onClick={list.more}>Muat lebih banyak</Button>}
      </div>
      {viewing && <EvidenceViewer item={viewing.item} onClose={closeViewer} />}
    </>
  );
}
