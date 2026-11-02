import { parseNumber } from '@evo/shared';

export type CameraMeta = {
  source: 'camera' | 'gallery';
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  taken_at: string | null;
};

const FUTURE_SLACK_MS = 5 * 60_000;
const MAX_AGE_MS = 14 * 86_400_000;
const text = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
const NONE: Omit<CameraMeta, 'source'> = { gps_lat: null, gps_lng: null, gps_accuracy: null, taken_at: null };

/**
 * Location and photo time come from the phone. Only the in-app camera may carry them;
 * a photo picked from the gallery cannot be proven, so its fields are dropped.
 */
export function readCameraMeta(form: FormData, now: Date): CameraMeta | { error: string } {
  const raw = form.get('source');
  const source = raw === null || raw === '' ? 'gallery' : raw;
  if (source !== 'camera' && source !== 'gallery') return { error: 'Sumber foto tidak dikenal.' };
  if (source === 'gallery') return { source, ...NONE };

  const takenRaw = text(form.get('taken_at'));
  if (!takenRaw) return { error: 'Waktu foto kamera wajib ada.' };
  const taken = Date.parse(takenRaw);
  if (Number.isNaN(taken)) return { error: 'Waktu foto tidak valid.' };
  if (taken > now.getTime() + FUTURE_SLACK_MS) return { error: 'Waktu foto tidak boleh di masa depan.' };
  if (taken < now.getTime() - MAX_AGE_MS) return { error: 'Waktu foto terlalu lama.' };

  const latRaw = text(form.get('gps_lat'));
  const lngRaw = text(form.get('gps_lng'));
  const base = { source: 'camera' as const, taken_at: new Date(taken).toISOString() };
  if (!latRaw && !lngRaw) return { ...base, ...NONE, taken_at: base.taken_at };
  if (!latRaw || !lngRaw) return { error: 'Lintang dan bujur harus dikirim berpasangan.' };
  const lat = parseNumber(latRaw);
  const lng = parseNumber(lngRaw);
  if (lat === 'invalid' || lat === null || lat < -90 || lat > 90) return { error: 'Lintang harus antara -90 dan 90.' };
  if (lng === 'invalid' || lng === null || lng < -180 || lng > 180) return { error: 'Bujur harus antara -180 dan 180.' };

  const accRaw = text(form.get('gps_accuracy'));
  let accuracy: number | null = null;
  if (accRaw) {
    const a = parseNumber(accRaw);
    if (a === 'invalid' || a === null || a < 0 || a > 100000) return { error: 'Akurasi lokasi harus antara 0 dan 100000.' };
    accuracy = a;
  }
  return { ...base, gps_lat: lat, gps_lng: lng, gps_accuracy: accuracy };
}
