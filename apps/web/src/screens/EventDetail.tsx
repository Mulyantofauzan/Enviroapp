import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FREQUENCY_LABEL, canWrite, formatDateId, formatNumber, todayInSite, type EventOccurrence } from '@evo/shared';
import { ApiError, api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/EventCard';
import { useToast } from '../components/Toast';
import { Icon } from '../icons';
import { dayMonth } from '../lib/dates';
import { usePond } from '../pond/PondContext';
import { Badge } from '../ui/Badge';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { pondLabel } from '../ui/PondPicker';
import { ScreenHeader } from '../ui/ScreenHeader';

type Evidence = { id: string; filename: string; mime: string; size: number; uploaded_at: string; uploaded_by_name: string; uploaded_by: string };
type Detail = { today: string; event: EventOccurrence; evidences: Evidence[] };

const MAX_BYTES = 10 * 1024 * 1024;
const PREVIEW = ['image/jpeg', 'image/png', 'image/webp'];

const sizeText = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${formatNumber(n / 1024, 1)} KB` : `${formatNumber(n / (1024 * 1024), 1)} MB`);
const whenText = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)).replace('.', ':');

export function EventDetail() {
  const { scheduleId, date } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { ponds } = usePond();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await api<Detail>(`/events/${scheduleId}/${date}`));
      setError('');
      setNotFound(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError((e as Error).message);
    }
  }, [scheduleId, date]);
  useEffect(() => { setDetail(null); load(); }, [load]);

  const back = <Link to="/kalender" className="ui-back"><Icon name="chevron-left" /> Kembali ke Kalender</Link>;
  const header = (title: string, subtitle?: string) => <ScreenHeader title={title} subtitle={subtitle} onProfile={() => nav('/akun')} />;

  if (notFound) return (<>{header('Eksekusi Event')}<div className="ui-page">{back}<p className="ui-muted">Event tidak ditemukan.</p></div></>);
  if (error) return (<>{header('Eksekusi Event')}<div className="ui-page">{back}<p className="ui-error" role="alert">{error}</p></div></>);
  if (!detail) return (<>{header('Eksekusi Event')}<div className="ui-page">{back}<p className="ui-muted">Memuat…</p></div></>);

  const { event: e, evidences } = detail;
  const pond = ponds.find((p) => p.id === e.sp_id);
  const acts = !!user && canWrite(user.role);
  const open = e.status === 'overdue' || e.status === 'today';
  const canUse = acts && open;
  const canDelete = (x: Evidence) => canUse && (x.uploaded_by === user!.id || user!.role === 'Admin');

  async function run<T>(fn: () => Promise<T>, ok: string) {
    setBusy(true);
    try { await fn(); toast(ok); await load(); } catch (err) { toast((err as Error).message); } finally { setBusy(false); }
  }
  function choose(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) { toast('Berkas terlalu besar. Maksimal 10 MB.'); return; }
    const form = new FormData();
    form.append('file', file);
    run(() => api(`/events/${e.schedule_id}/${e.due_date}/evidence`, { method: 'POST', body: form }), 'Eviden diunggah');
  }

  return (
    <>
      {header(e.title, pond ? pondLabel(pond) : 'Semua lokasi')}
      <div className="ui-page">
        {back}
        <section className={`ui-card ui-evbox${e.status === 'overdue' ? ' is-overdue' : ''}`}>
          <div className="ui-ev__head"><strong>{FREQUENCY_LABEL[e.frequency]} - tenggat {dayMonth(e.due_date)}</strong><StatusBadge e={e} /></div>
          {e.description && <p>{e.description}</p>}
          {e.status === 'done' && (
            <p className="ui-muted">
              Diselesaikan oleh {e.completed_by_name} pada {formatDateId(todayInSite(new Date(e.completed_at!)))} {e.late && <Badge tone="warning">Terlambat</Badge>}
            </p>
          )}
        </section>

        <section className="ui-card ui-stack" aria-label="Eviden">
          <h2>Eviden ({evidences.length})</h2>
          {evidences.length === 0 && <p className="ui-muted">Belum ada eviden.</p>}
          <ul className="ui-evlist">
            {evidences.map((x) => (
              <li key={x.id} className="ui-evrow">
                {PREVIEW.includes(x.mime)
                  ? <img src={`/api/evidence/${x.id}/file`} alt={x.filename} loading="lazy" />
                  : <span className="ui-bubble ui-bubble--primary"><Icon name="file" /></span>}
                <div className="ui-evrow__main">
                  <strong>{x.filename}</strong>
                  <small>{sizeText(x.size)} - {x.uploaded_by_name} - {whenText(x.uploaded_at)}</small>
                </div>
                <a className="ui-evrow__dl" href={`/api/evidence/${x.id}/file`} download={x.filename} aria-label={`Unduh ${x.filename}`}><Icon name="upload" /></a>
                {canDelete(x) && (
                  <button type="button" className="ui-iconbtn" aria-label={`Hapus ${x.filename}`} disabled={busy} onClick={() => run(() => api(`/evidence/${x.id}`, { method: 'DELETE' }), 'Eviden dihapus')}>
                    <Icon name="trash" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canUse && (
            <label className={`ui-btn ui-btn--primary ui-file${busy ? ' is-busy' : ''}`}>
              <Icon name="upload" /> Unggah galeri
              <input type="file" className="ui-sr" accept="image/*,application/pdf" disabled={busy} onChange={choose} />
            </label>
          )}
        </section>

        {acts && e.status === 'upcoming' && <Banner tone="info" title="Belum waktunya">Eviden bisa diunggah mulai {formatDateId(e.due_date)}</Banner>}
        {canUse && (
          <>
            <Banner tone="info" title={e.status === 'overdue' ? 'Overdue tetap tampil' : 'Selesai setelah eviden diunggah'}>
              {e.status === 'overdue' ? 'Selesai setelah eviden diunggah' : 'Unggah minimal satu eviden, lalu selesaikan event.'}
            </Banner>
            <Button block disabled={evidences.length === 0 || busy} onClick={() => run(() => api(`/events/${e.schedule_id}/${e.due_date}/complete`, { method: 'POST' }), 'Event diselesaikan')}>
              Selesaikan event
            </Button>
            {evidences.length === 0 && <p className="ui-muted">Unggah minimal satu eviden dulu.</p>}
          </>
        )}
      </div>
    </>
  );
}
