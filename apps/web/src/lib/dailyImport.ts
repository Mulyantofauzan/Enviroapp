import { DAILY_IMPORT_MAX_ROWS, normalizeKey, type DailyInputRow } from '@evo/shared';
import { buildSimpleXlsx } from './xlsx';
import type { ReadSheet } from './xlsxRead';

const HEADER_SCAN_ROWS = 5;
const MESSAGE_COUNT = `Berkas harus berisi 1 sampai ${DAILY_IMPORT_MAX_ROWS} baris.`;

type Col = Exclude<keyof DailyInputRow, 'row'>;
const NAMES: Record<Col, string[]> = {
  date: ['tanggal'],
  pond: ['pond'],
  rainfall: ['curah hujan (mm)', 'curah hujan', 'rainfall (mm)'],
  rain_hours: ['jam hujan', 'rain hours (hrs)'],
  ph_inlet: ['ph inlet'],
  ph_outlet: ['ph outlet'],
  tss_inlet: ['tss inlet', 'tss inlet (mg/l)'],
  tss_outlet: ['tss outlet', 'tss outlet (mg/l)'],
  debit_inlet: ['debit inlet (l/s)', 'debit inlet'],
  debit_outlet: ['debit outlet (l/s)', 'debit outlet'],
  serbuk_in: ['tawas serbuk masuk (kg)', 'tawas serbuk masuk'],
  serbuk_out: ['tawas serbuk keluar (kg)', 'tawas serbuk keluar'],
  batu_in: ['tawas batu masuk (kg)', 'tawas batu masuk'],
  batu_out: ['tawas batu keluar (kg)', 'tawas batu keluar'],
  kapur_in: ['kapur masuk (kg)', 'kapur masuk'],
  kapur_out: ['kapur keluar (kg)', 'kapur keluar'],
};
const COLS = Object.keys(NAMES) as Col[];

const HEADERS = [
  'Tanggal', 'Pond', 'Curah hujan (mm)', 'Jam hujan', 'pH inlet', 'pH outlet', 'TSS inlet', 'TSS outlet', 'Debit inlet (L/S)', 'Debit outlet (L/S)',
  'Tawas Serbuk masuk (kg)', 'Tawas Serbuk keluar (kg)', 'Tawas Batu masuk (kg)', 'Tawas Batu keluar (kg)', 'Kapur masuk (kg)', 'Kapur keluar (kg)',
];

function findHeader(rows: string[][]): { at: number; cols: Partial<Record<Col, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, HEADER_SCAN_ROWS); i++) {
    const cols: Partial<Record<Col, number>> = {};
    rows[i].forEach((text, j) => {
      const key = normalizeKey(text);
      for (const name of COLS) if (cols[name] === undefined && NAMES[name].includes(key)) cols[name] = j;
    });
    if (cols.date !== undefined && cols.pond !== undefined) return { at: i, cols };
  }
  return null;
}

/** Turns the text of a spreadsheet into import rows. Throws a plain-language Error when the file is not usable. */
export function rowsToDaily(sheets: ReadSheet[]): DailyInputRow[] {
  const sheet = sheets.find((s) => normalizeKey(s.name) === 'data') ?? sheets[0];
  const header = sheet && findHeader(sheet.rows);
  if (!header) throw new Error('Kolom Tanggal dan Pond tidak ditemukan. Pakai templat.');
  const out: DailyInputRow[] = [];
  sheet.rows.forEach((row, i) => {
    if (i <= header.at || row.every((c) => c.trim() === '')) return;
    const r: Record<string, unknown> = { row: i + 1 };
    for (const name of COLS) {
      const j = header.cols[name];
      const v = j === undefined ? '' : (row[j] ?? '').trim();
      r[name] = v === '' ? null : v;
    }
    out.push(r as DailyInputRow);
  });
  if (out.length < 1 || out.length > DAILY_IMPORT_MAX_ROWS) throw new Error(MESSAGE_COUNT);
  return out;
}

/** The template people download: a sheet with the columns and three examples, and a sheet explaining the rules. */
export function buildDailyTemplate(): Uint8Array {
  const ex = (cells: Record<number, string>) => HEADERS.map((_, i) => cells[i] ?? '');
  return buildSimpleXlsx([
    {
      name: 'Data', header: true, widths: HEADERS.map((h) => Math.max(12, h.length + 2)),
      rows: [
        HEADERS,
        ex({ 0: '2026-04-01', 1: 'SP11', 2: '12,5', 3: '3', 4: '6,8', 5: '7,2', 6: '1450', 7: '38', 8: '500', 9: '250', 10: '100', 11: '25', 12: '50', 13: '10' }),
        ex({ 0: '2026-04-02', 1: 'SP11', 2: '0', 3: '0', 4: '6,9', 5: '0', 6: '900', 7: '0', 8: '300', 9: '0', 11: '25', 13: '10' }),
        ex({ 0: '2026-04-03', 1: 'SP11', 4: '7', 5: '7,1', 6: '1200', 7: '40', 8: '480', 9: '240', 14: '20', 15: '5' }),
      ],
    },
    {
      name: 'Petunjuk', widths: [110],
      rows: [
        ['Isi lembar Data, satu baris untuk satu tanggal dan satu pond. Jangan ubah nama kolom. Kolom yang tidak dipakai boleh dikosongkan.'],
        ['Tanggal: wajib. Boleh ditulis 2026-04-01, 01/04/2026, atau sebagai tanggal Excel biasa. Tidak boleh di masa depan.'],
        ['Pond: wajib. Tulis kode pond (mis. SP11) persis seperti di aplikasi. Pond harus aktif.'],
        ['Curah hujan dan jam hujan berlaku per tanggal, bukan per pond. Kalau dua baris pada tanggal yang sama mengisinya, nilainya harus sama.'],
        ['Debit ditulis dalam L/S (liter per detik). Aplikasi mengubahnya sendiri ke m3/s.'],
        ['Koagulan ditulis dalam kg, termasuk Tawas Serbuk. Sisa stok tidak perlu diisi, dihitung otomatis berurutan menurut tanggal.'],
        ['Hari tanpa air keluar dari pond (no flow): isi Debit outlet dengan 0. pH dan TSS boleh diisi 0 atau ditulis No Flow.'],
        ['Sel kosong, tulisan no data, atau No Flow berarti tidak ada nilai. Sel kosong tidak menimpa data yang sudah ada di aplikasi.'],
        ['Angka boleh memakai koma desimal (7,2). Pemisah ribuan boleh, mis. 1.234,5. Satu titik dengan tiga angka di belakang dibaca desimal: 1.234 berarti 1,234. Untuk angka ribuan, tulis 1234 atau 1.234,0.'],
        ['pH harus 0 sampai 14, jam hujan 0 sampai 24, nilai lain tidak boleh negatif.'],
        ['Mengimpor berkas yang sama dua kali tidak membuat data ganda. Data pada tanggal dan pond yang sama diperbarui.'],
        ['Maksimal 1000 baris per berkas.'],
      ],
    },
  ]);
}
