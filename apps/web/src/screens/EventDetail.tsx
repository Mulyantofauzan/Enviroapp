import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FREQUENCY_LABEL, canWrite, formatDateId, formatNumber, todayInSite, type EventOccurrence } from '@evo/shared';
import { ApiError, api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/EventCard';
import { useToast } from '../components/Toast';
import { Icon } from '../icons';
import { dayMonth } from '../lib/dates';
import { completeEvent, saveEvidence, type SaveResult } from '../lib/outbox/save';
import { useOutbox } from '../hooks/useOutbox';
import { Badge } from '../ui/Badge';
import { CameraCapture, type CameraPhoto } from '../components/CameraCapture';
import { EvidenceMeta } from '../components/EvidenceMeta';
import { EvidenceViewer } from '../components/EvidenceViewer';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { ScreenHeader } from '../ui/ScreenHeader';

type Evidence = {
  id: string; filename: string; mime: string; size: number; uploaded_at: string; uploaded_by_name: string; uploaded_by: string;
  source?: 'camera' | 'gallery'; gps_lat?: number | null; gps_lng?: number | null; gps_accuracy?: number | null; taken_at?: string | null;
};
type Detail = { today: string; event: EventOccurrence; evidences: Evidence[] };

const MAX_BYTES = 10 * 1024 * 1024;
const QUEUED_PHOTO = 'Foto tersimpan di HP, menunggu sinyal';
const QUEUED_DONE = 'Penyelesaian tersimpan di HP, menunggu sinyal';
const isQueued = (r: unknown): r is SaveResult => !!r && typeof r === 'object' && (r as SaveResult).queued === true;
const PREVIEW = ['image/jpeg', 'image/png', 'image/webp'];

const sizeText = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${formatNumber(n / 1024, 1)} KB` : `${formatNumber(n / (1024 * 1024), 1)} MB`);
const whenText = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)).replace('.', ':');

export function EventDetail() {
  const { scheduleId, date } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const outbox = useOutbox();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [viewing, setViewing] = useState<{ item: Evidence; opener: HTMLElement | null } | null>(null);

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
  useEffect(() => {
    window.addEventListener('outbox:drained', load);
    return () => window.removeEventListener('outbox:drained', load);
  }, [load]);

  const back = <Link to="/kalender" className="ui-back"><Icon name="chevron-left" /> Kembali ke Kalender</Link>;
  const header = (title: string, subtitle?: string) => <ScreenHeader title={title} subtitle={subtitle} onProfile={() => nav('/akun')} />;

  if (notFound) return (<>{header('Eksekusi Event')}<div className="ui-page">{back}<p className="ui-muted">Event tidak ditemukan.</p></div></>);
  if (error) return (<>{header('Eksekusi Event')}<div className="ui-page">{back}<p className="ui-error" role="alert">{error}</p></div></>);
  if (!detail) return (<>{header('Eksekusi Event')}<div className="ui-page">{back}<p className="ui-muted">Memuat…</p></div></>);

  const { event: e, evidences } = detail;
  const group = `${e.schedule_id}|${e.due_date}`;
  const queuedPhotos = outbox.items.filter((i) => i.kind === 'evidence' && i.group === group);
  const completing = outbox.items.some((i) => i.kind === 'complete' && i.group === group);
  const photoCount = evidences.length + queuedPhotos.length;
  const acts = !!user && canWrite(user.role);
  const open = e.status === 'overdue' || e.status === 'today';
  const canUse = acts && open;
  const canDelete = (x: Evidence) => canUse && (x.uploaded_by === user!.id || user!.role === 'Admin');

  async function run<T>(fn: () => Promise<T>, ok: string, queuedText = 'Tersimpan di HP, menunggu sinyal') {
    setBusy(true);
    try {
      const r = await fn();
      if (isQueued(r)) toast(queuedText);
      else { toast(ok); await load(); }
    } catch (err) { toast((err as Error).message); } finally { setBusy(false); }
  }
  function send(file: File, photo?: CameraPhoto) {
    const fields: Record<string, string> = { source: photo ? 'camera' : 'gallery' };
    if (photo) {
      fields.taken_at = photo.takenAt;
      if (photo.lat !== null && photo.lng !== null) {
        fields.gps_lat = String(photo.lat);
        fields.gps_lng = String(photo.lng);
        if (photo.accuracy !== null) fields.gps_accuracy = String(photo.accuracy);
      }
    }
    return saveEvidence({ owner: user!.id, scheduleId: e.schedule_id, date: e.due_date, label: `Foto ${e.title}`, file, fields });
  }
  function checkSize(file: File) {
    if (file.size > MAX_BYTES) { toast('Berkas terlalu besar. Maksimal 10 MB.'); return false; }
    return true;
  }
  function choose(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file || !checkSize(file)) return;
    run(() => send(file), 'Eviden diunggah', QUEUED_PHOTO);
  }
  /** Throws when the server refuses, so the camera stays open and the photo can be tried again. */
  async function useCameraPhoto(photo: CameraPhoto) {
    const stamp = photo.takenAt.slice(0, 16).replace(/[-:T]/g, '');
    const r = await send(new File([photo.blob], `foto-${stamp}.jpg`, { type: 'image/jpeg' }), photo);
    setCamera(false);
    toast(r.queued ? QUEUED_PHOTO : 'Eviden diunggah');
    if (!r.queued) await load();
  }
  function galleryFromCamera(file: File) {
    setCamera(false);
    if (checkSize(file)) run(() => send(file), 'Eviden diunggah', QUEUED_PHOTO);
  }
  function closeViewer() {
    viewing?.opener?.focus();
    setViewing(null);
  }

  return (
    <>
      {header(e.title, e.category_name ?? 'Tanpa kategori')}
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
          {photoCount === 0 && <p className="ui-muted">Belum ada eviden.</p>}
          <ul className="ui-evlist">
            {evidences.map((x) => (
              <li key={x.id} className="ui-evrow">
                {PREVIEW.includes(x.mime)
                  ? (
                    <button type="button" className="ui-evrow__thumb" aria-label={`Lihat ${x.filename}`} onClick={(ev) => setViewing({ item: x, opener: ev.currentTarget })}>
                      <img src={`/api/evidence/${x.id}/file`} alt={x.filename} loading="lazy" />
                    </button>
                  )
                  : <span className="ui-bubble ui-bubble--primary"><Icon name="file" /></span>}
                <div className="ui-evrow__main">
                  <strong>{x.filename}</strong>
                  <small>{sizeText(x.size)} - {x.uploaded_by_name} - {whenText(x.uploaded_at)}</small>
                  <EvidenceMeta e={x} />
                </div>
                <a className="ui-evrow__dl" href={`/api/evidence/${x.id}/file`} download={x.filename} aria-label={`Unduh ${x.filename}`}><Icon name="upload" /></a>
                {canDelete(x) && (
                  <button type="button" className="ui-iconbtn" aria-label={`Hapus ${x.filename}`} disabled={busy} onClick={() => run(() => api(`/evidence/${x.id}`, { method: 'DELETE' }), 'Eviden dihapus')}>
                    <Icon name="trash" />
                  </button>
                )}
              </li>
            ))}
            {queuedPhotos.map((q) => (
              <li key={q.id} className="ui-evrow">
                <span className="ui-bubble ui-bubble--primary"><Icon name="upload" /></span>
                <div className="ui-evrow__main">
                  <strong>{q.request.filename}</strong>
                  {q.status === 'failed' ? <small>Gagal diunggah: {q.error}</small> : <Badge tone="warning">Menunggu unggah</Badge>}
                </div>
              </li>
            ))}
          </ul>
          {canUse && (
            <div className="ui-evactions">
              <Button disabled={busy} onClick={() => setCamera(true)}><Icon name="camera" /> Ambil foto</Button>
              <label className={`ui-btn ui-btn--outline ui-file${busy ? ' is-busy' : ''}`}>
                <Icon name="upload" /> Unggah galeri
                <input type="file" className="ui-sr" accept="image/*,application/pdf" disabled={busy} onChange={choose} />
              </label>
            </div>
          )}
        </section>

        {acts && e.status === 'upcoming' && <Banner tone="info" title="Belum waktunya">Eviden bisa diunggah mulai {formatDateId(e.due_date)}</Banner>}
        {canUse && (
          <>
            <Banner tone="info" title={e.status === 'overdue' ? 'Overdue tetap tampil' : 'Selesai setelah eviden diunggah'}>
              {e.status === 'overdue' ? 'Selesai setelah eviden diunggah' : 'Unggah minimal satu eviden, lalu selesaikan event.'}
            </Banner>
            <Button block disabled={photoCount === 0 || busy || completing} onClick={() => run(() => completeEvent({ owner: user!.id, scheduleId: e.schedule_id, date: e.due_date, label: `Selesai ${e.title}` }), 'Event diselesaikan', QUEUED_DONE)}>
              Selesaikan event
            </Button>
            {completing && <p className="ui-muted">Penyelesaian menunggu unggah. Event ditandai selesai setelah semua foto terunggah.</p>}
            {photoCount === 0 && <p className="ui-muted">Unggah minimal satu eviden dulu.</p>}
          </>
        )}
      </div>
      {camera && <CameraCapture title={e.title} onClose={() => setCamera(false)} onUse={useCameraPhoto} onGallery={galleryFromCamera} />}
      {viewing && <EvidenceViewer item={{ ...viewing.item, title: e.title, due_date: e.due_date }} onClose={closeViewer} />}
    </>
  );
}
