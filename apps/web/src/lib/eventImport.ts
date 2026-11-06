import { normalizeKey, type ImportInputRow } from '@evo/shared';
import { buildSimpleXlsx } from './xlsx';
import type { ReadSheet } from './xlsxRead';

const MAX_ROWS = 500;
const HEADER_SCAN_ROWS = 5;
const NAMES = {
  category: ['kategori'],
  title: ['event', 'outstanding'],
  frequency: ['frekuensi atau due date', 'frekuensi', 'due date'],
  start: ['tanggal mulai'],
};
type Col = keyof typeof NAMES;

function findHeader(rows: string[][]): { at: number; cols: Partial<Record<Col, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, HEADER_SCAN_ROWS); i++) {
    const cols: Partial<Record<Col, number>> = {};
    rows[i].forEach((text, j) => {
      const k = normalizeKey(text);
      for (const name of Object.keys(NAMES) as Col[]) if (cols[name] === undefined && NAMES[name].includes(k)) cols[name] = j;
    });
    if (cols.title !== undefined && cols.frequency !== undefined) return { at: i, cols };
  }
  return null;
}

/** Turns the text of a spreadsheet into import rows. Throws a plain-language Error when the file is not usable. */
export function rowsToImport(sheets: ReadSheet[]): ImportInputRow[] {
  const sheet = sheets.find((s) => normalizeKey(s.name) === 'event') ?? sheets[0];
  const header = sheet && findHeader(sheet.rows);
  if (!header) throw new Error('Kolom Event dan Frekuensi atau due date tidak ditemukan. Pakai templat.');
  const get = (row: string[], col: Col): string | null => {
    const j = header.cols[col];
    const v = j === undefined ? '' : (row[j] ?? '').trim();
    return v === '' ? null : v;
  };
  const out: ImportInputRow[] = [];
  sheet.rows.forEach((row, i) => {
    if (i <= header.at || row.every((c) => c.trim() === '')) return;
    out.push({ row: i + 1, category: get(row, 'category'), title: get(row, 'title') ?? '', frequency: get(row, 'frequency'), start: get(row, 'start') });
  });
  if (out.length > MAX_ROWS) throw new Error('Berkas harus berisi 1 sampai 500 baris.');
  return out;
}

/** The template people download: a sheet with the columns and three examples, and a sheet explaining the rules. */
export function buildImportTemplate(): Uint8Array {
  return buildSimpleXlsx([
    {
      name: 'Event', header: true, widths: [22, 44, 26, 16],
      rows: [
        ['Kategori', 'Event', 'Frekuensi atau due date', 'Tanggal mulai'],
        ['Air', 'Pemeriksaan kualitas air outlet', 'Bulanan', '2026-11-01'],
        ['Peralatan', 'Kalibrasi alat ukur debit', 'Tahunan', '2027-02-15'],
        ['Perizinan', 'Pelaporan RKL-RPL tahunan', '2027-03-31', ''],
      ],
    },
    {
      name: 'Petunjuk', widths: [100],
      rows: [
        ['Isi lembar Event, satu baris untuk satu event. Jangan ubah nama kolom.'],
        ['Kategori: boleh kosong. Kategori yang belum ada dibuat otomatis.'],
        ['Event: nama event, maksimal 120 karakter. Wajib.'],
        ['Frekuensi atau due date: Harian, Mingguan, Bulanan, 3-Bulanan, 6-Bulanan, atau Tahunan. Atau isi sebuah tanggal untuk kegiatan yang berulang tiap tahun di tanggal itu.'],
        ['Tanggal mulai: wajib untuk frekuensi berulang (kata). Dikosongkan bila kolom frekuensi berisi tanggal.'],
        ['Tanggal boleh ditulis 2026-11-01, 01/11/2026, atau sebagai tanggal Excel biasa.'],
        ['Event dengan judul dan kategori yang sama dengan yang sudah ada akan diperbarui. Event yang sudah punya catatan tidak diubah.'],
        ['Maksimal 500 baris per berkas.'],
      ],
    },
  ]);
}
