import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { captureStamped } from '../lib/capture';
import { formatCoords, stampText, witaStamp } from '../lib/stamp';
import { useGeolocation } from '../hooks/useGeolocation';

export type CameraPhoto = { blob: Blob; lat: number | null; lng: number | null; accuracy: number | null; takenAt: string };

type Props = {
  title: string;
  onClose: () => void;
  onUse: (photo: CameraPhoto) => void | Promise<void>;
  onGallery: (file: File) => void;
};

type ErrorKind = 'insecure' | 'denied' | 'none' | 'other';
const MESSAGE: Record<ErrorKind, string> = {
  insecure: 'Kamera butuh koneksi aman (HTTPS).',
  denied: 'Izin kamera ditolak. Aktifkan di pengaturan peramban.',
  none: 'Kamera tidak ditemukan.',
  other: 'Kamera tidak bisa dibuka. Coba lagi.',
};
const kindOf = (e: unknown): ErrorKind => {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'none';
  return 'other';
};

/** Full-screen camera. The stream is stopped on every way out so the camera light never stays on. */
export function CameraCapture({ title, onClose, onUse, onGallery }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<'starting' | 'live' | 'error'>('starting');
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<'capture' | 'upload' | null>(null);
  const [photo, setPhoto] = useState<(CameraPhoto & { url: string }) | null>(null);
  const [now, setNow] = useState(() => new Date());
  const geo = useGeolocation(true);
  const geoRef = useRef(geo);
  geoRef.current = geo;
  const previewing = photo !== null;
  const uploadingRef = useRef(false);
  uploadingRef.current = busy === 'upload';

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (previewing) return;
    let cancelled = false;
    const fail = (k: ErrorKind) => { setErrorKind(k); setPhase('error'); };
    (async () => {
      setPhase('starting');
      setErrorKind(null);
      if (!window.isSecureContext) return fail('insecure');
      const md = navigator.mediaDevices;
      if (!md?.getUserMedia) return fail('none');
      try {
        const stream = await md.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        stopStream();
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; try { await v.play(); } catch { /* autoplay may need a tap; the picture still shows */ } }
        if (!cancelled) setPhase('live');
      } catch (e) {
        if (cancelled) return;
        stopStream();
        fail(kindOf(e));
      }
    })();
    return () => { cancelled = true; stopStream(); };
  }, [facing, attempt, previewing, stopStream]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !uploadingRef.current) onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; window.clearInterval(tick); };
  }, [onClose]);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  async function shoot() {
    if (lock.current || phase !== 'live' || !videoRef.current) return;
    lock.current = true;
    setBusy('capture');
    setNotice('');
    const at = new Date();
    const p = geoRef.current.position;
    try {
      const blob = await captureStamped(videoRef.current, stampText(p ? { lat: p.lat, lng: p.lng } : null, at));
      stopStream();
      setPhoto({ blob, url: URL.createObjectURL(blob), lat: p?.lat ?? null, lng: p?.lng ?? null, accuracy: p?.accuracy ?? null, takenAt: at.toISOString() });
    } catch (e) {
      setNotice((e as Error).message || 'Gagal membuat foto.');
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function use() {
    if (!photo || lock.current) return;
    lock.current = true;
    setBusy('upload');
    setNotice('');
    try {
      await onUse({ blob: photo.blob, lat: photo.lat, lng: photo.lng, accuracy: photo.accuracy, takenAt: photo.takenAt });
    } catch (e) {
      setNotice((e as Error).message || 'Gagal mengunggah. Coba lagi.');
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  function retake() {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
  }

  const pos = geo.position;
  const location = pos ? `GPS ${formatCoords(pos.lat, pos.lng)}` : geo.status === 'locating' ? 'Mencari lokasi…' : 'Lokasi tidak tersedia';
  const gallery = (
    <label className="ui-cam__side">
      <Icon name="image" />
      <span className="ui-sr">Pilih dari galeri</span>
      <input type="file" className="ui-sr" accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onGallery(f); }} />
    </label>
  );

  return (
    <div className="ui-cam" role="dialog" aria-modal="true" aria-label="Kamera eviden">
      <header className="ui-cam__head">
        <div><h2>Kamera eviden</h2><p>{title}</p></div>
        <button type="button" ref={closeRef} className="ui-cam__close" aria-label="Tutup kamera" disabled={busy === 'upload'} onClick={onClose}><Icon name="x" /></button>
      </header>

      <div className="ui-cam__view">
        {previewing ? <img src={photo!.url} alt="Pratinjau foto" /> : <video ref={videoRef} playsInline muted autoPlay />}
        {phase === 'error' && !previewing && <div className="ui-cam__error" role="alert">{MESSAGE[errorKind ?? 'other']}</div>}
        {notice && <div className="ui-cam__error ui-cam__error--low" role="alert">{notice}</div>}
      </div>

      <div className="ui-cam__info">
        <span><Icon name="pin" size={16} /> {pos ? <><span>{location}</span> <small>± {Math.round(pos.accuracy)} m</small></> : <span>{location}</span>}</span>
        <span><Icon name="calendar" size={16} /> {witaStamp(now)} WITA</span>
        <small>Geotag dan timestamp otomatis ditempel pada foto</small>
      </div>

      <div className="ui-cam__bar">
        {previewing ? (
          <>
            <button type="button" className="ui-btn ui-btn--outline ui-cam__again" disabled={busy !== null} onClick={retake}>Ulangi</button>
            <button type="button" className="ui-btn ui-btn--primary" disabled={busy !== null} onClick={use}>{busy === 'upload' ? 'Mengunggah…' : 'Gunakan foto'}</button>
          </>
        ) : (
          <>
            {gallery}
            {phase === 'error' ? (
              errorKind === 'other'
                ? <button type="button" className="ui-btn ui-btn--outline" onClick={() => setAttempt((a) => a + 1)}>Coba lagi</button>
                : <span />
            ) : (
              <button type="button" className="ui-cam__shutter" aria-label="Ambil foto" disabled={phase !== 'live' || busy !== null} onClick={shoot}><span /></button>
            )}
            <button type="button" className="ui-cam__side" aria-label="Balik kamera" disabled={phase === 'error'} onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}><Icon name="refresh" /></button>
          </>
        )}
      </div>
    </div>
  );
}
