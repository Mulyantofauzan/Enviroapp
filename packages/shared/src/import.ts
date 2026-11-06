import { EVENT_FREQUENCIES, FREQUENCY_LABEL, type EventFrequency } from './events';

/** One spreadsheet row, every cell as text. `row` is the Excel row number. */
export type ImportInputRow = { row: number; category: string | null; title: string; frequency: string | null; start: string | null };

export type ImportRowOk = { ok: true; title: string; category: string | null; frequency: EventFrequency; start_date: string };
export type ImportRowBad = { ok: false; error: string };

const squeeze = (s: string) => s.trim().replace(/\s+/g, ' ');
export const normalizeKey = (s: string): string => squeeze(s).toLowerCase();

const SERIAL_MIN = 36526; // 2000-01-01
const SERIAL_MAX = 73050; // 2099-12-31
const iso = (y: number, m: number, d: number): string | null => {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
};

/** Accepts YYYY-MM-DD, D/M/YYYY and an Excel date serial; anything else is null. */
export function parseDateCell(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s));
    if (n < SERIAL_MIN || n > SERIAL_MAX) return null;
    return new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10);
  }
  return null;
}

const FREQUENCY_BY_NAME = new Map<string, EventFrequency>(
  EVENT_FREQUENCIES.flatMap((f) => [[normalizeKey(f), f], [normalizeKey(FREQUENCY_LABEL[f]), f]] as [string, EventFrequency][]),
);

export function parseFrequencyCell(raw: string): { kind: 'frequency'; frequency: EventFrequency } | { kind: 'date'; date: string } | null {
  const f = FREQUENCY_BY_NAME.get(normalizeKey(raw));
  if (f) return { kind: 'frequency', frequency: f };
  const date = parseDateCell(raw);
  return date ? { kind: 'date', date } : null;
}

/** A start date outside 2000-01-01 .. five years from today is almost certainly a typo (e.g. 0202). */
export function startDateInRange(date: string, today: string): boolean {
  return date >= '2000-01-01' && date <= `${Number(today.slice(0, 4)) + 5}${today.slice(4)}`;
}

const RANGE_MSG = 'Tanggal harus antara 1 Jan 2000 dan 5 tahun dari sekarang.';

export function validateImportRow(r: ImportInputRow, today: string): ImportRowOk | ImportRowBad {
  const title = squeeze(r.title ?? '');
  if (!title) return { ok: false, error: 'Judul wajib diisi.' };
  if (title.length > 120) return { ok: false, error: 'Judul maksimal 120 karakter.' };
  const category = squeeze(r.category ?? '') || null;
  const freqText = (r.frequency ?? '').trim();
  if (!freqText) return { ok: false, error: 'Frekuensi atau tanggal wajib diisi.' };
  const f = parseFrequencyCell(freqText);
  if (!f) return { ok: false, error: 'Frekuensi tidak dikenal. Isi Harian, Mingguan, Bulanan, 3-Bulanan, 6-Bulanan, Tahunan, atau sebuah tanggal.' };
  if (f.kind === 'date') {
    if (!startDateInRange(f.date, today)) return { ok: false, error: RANGE_MSG };
    return { ok: true, title, category, frequency: 'Annual', start_date: f.date };
  }
  const start = r.start ? parseDateCell(r.start) : null;
  if (!start) return { ok: false, error: 'Tanggal mulai wajib diisi untuk frekuensi berulang.' };
  if (!startDateInRange(start, today)) return { ok: false, error: RANGE_MSG };
  return { ok: true, title, category, frequency: f.frequency, start_date: start };
}
