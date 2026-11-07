import { describe, it, expect } from 'vitest';
import { validateDailyRow } from '@evo/shared';
import { readXlsx } from './xlsxRead';
import { buildDailyTemplate, rowsToDaily } from './dailyImport';

type Sheet = { name: string; rows: string[][] };
const sheet = (rows: string[][], name = 'Data'): Sheet => ({ name, rows });

describe('rowsToDaily', () => {
  it('reads the template back: sheets Data and Petunjuk, example rows numbered like Excel', () => {
    const { sheets } = readXlsx(buildDailyTemplate());
    expect(sheets.map((s) => s.name)).toEqual(['Data', 'Petunjuk']);
    expect(sheets[0].rows[0]).toEqual([
      'Tanggal', 'Pond', 'Curah hujan (mm)', 'Jam hujan', 'pH inlet', 'pH outlet', 'TSS inlet', 'TSS outlet', 'Debit inlet (L/S)', 'Debit outlet (L/S)',
      'Tawas Serbuk masuk (kg)', 'Tawas Serbuk keluar (kg)', 'Tawas Batu masuk (kg)', 'Tawas Batu keluar (kg)', 'Kapur masuk (kg)', 'Kapur keluar (kg)',
    ]);
    const rows = rowsToDaily(sheets);
    expect(rows.map((r) => r.row)).toEqual([2, 3, 4]);
    expect(rows[0]).toMatchObject({ date: '2026-04-01', pond: 'SP11' });
    for (const r of rows) expect(validateDailyRow(r, '2026-11-07').ok).toBe(true);
  });
  it('the template teaches the no-flow day: zero outlet debit', () => {
    const rows = rowsToDaily(readXlsx(buildDailyTemplate()).sheets);
    expect(rows.some((r) => r.debit_outlet === '0')).toBe(true);
  });
  it('finds columns by name in any order, ignoring case and edge spaces', () => {
    const rows = rowsToDaily([sheet([[' POND ', 'tanggal', 'pH Outlet', 'Debit outlet (l/s)'], ['SP11', '2026-04-01', '7,1', '250']])]);
    expect(rows).toEqual([expect.objectContaining({ row: 2, date: '2026-04-01', pond: 'SP11', ph_outlet: '7,1', debit_outlet: '250', ph_inlet: null, kapur_out: null })]);
  });
  it('ignores columns it does not know', () => {
    const rows = rowsToDaily([sheet([['Hari', 'Tanggal', 'Pond', 'Rain Intensity', 'pH Min'], ['Senin', '2026-04-01', 'SP11', '0,0', '6']])]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: '2026-04-01', pond: 'SP11' });
  });
  it('skips blank rows but keeps the Excel row number', () => {
    const rows = rowsToDaily([sheet([['Tanggal', 'Pond'], ['2026-04-01', 'SP11'], [], ['', ' '], ['2026-04-02', 'SP11']])]);
    expect(rows.map((r) => r.row)).toEqual([2, 5]);
  });
  it('finds the header when it is not on the first row', () => {
    const rows = rowsToDaily([sheet([['Data harian'], [], ['Tanggal', 'Pond'], ['2026-04-01', 'SP11']])]);
    expect(rows[0].row).toBe(4);
  });
  it('prefers the sheet named Data', () => {
    expect(rowsToDaily([sheet([['x']], 'Petunjuk'), sheet([['Tanggal', 'Pond'], ['2026-04-01', 'SP11']])])).toHaveLength(1);
  });
  it('explains a file without the key columns', () => {
    expect(() => rowsToDaily([sheet([['Hari', 'Catatan'], ['a', 'b']])])).toThrow('Kolom Tanggal dan Pond tidak ditemukan. Pakai templat.');
  });
  it('refuses more than 1000 data rows', () => {
    const data = Array.from({ length: 1001 }, (_, i) => [`2026-04-01`, `SP${i}`]);
    expect(() => rowsToDaily([sheet([['Tanggal', 'Pond'], ...data])])).toThrow('Berkas harus berisi 1 sampai 1000 baris.');
    expect(rowsToDaily([sheet([['Tanggal', 'Pond'], ...data.slice(0, 1000)])])).toHaveLength(1000);
  });
  it('an empty data sheet is refused with the same message', () => {
    expect(() => rowsToDaily([sheet([['Tanggal', 'Pond']])])).toThrow('Berkas harus berisi 1 sampai 1000 baris.');
  });
  it('the instructions sheet states the rules people trip over', () => {
    const text = readXlsx(buildDailyTemplate()).sheets[1].rows.flat().join('\n');
    for (const needle of ['L/S', 'kg', 'No Flow', '0', '1000', '1.234']) expect(text).toContain(needle);
  });
});
