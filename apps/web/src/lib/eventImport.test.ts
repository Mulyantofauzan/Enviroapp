import { describe, it, expect } from 'vitest';
import { readXlsx } from './xlsxRead';
import { buildImportTemplate, rowsToImport } from './eventImport';

type Sheet = { name: string; rows: string[][] };
const sheet = (rows: string[][], name = 'Event'): Sheet => ({ name, rows });

describe('rowsToImport', () => {
  it('maps the template columns and numbers rows like Excel does', () => {
    const rows = rowsToImport(readXlsx(buildImportTemplate()).sheets);
    expect(rows.map((r) => r.row)).toEqual([2, 3, 4]);
    expect(rows[0]).toMatchObject({ category: 'Air', frequency: 'Bulanan' });
    expect(rows[2].frequency).toBe('2027-03-31');
    expect(rows[2].start).toBeNull();
  });
  it('finds columns by name in any order, ignoring case and edge spaces', () => {
    const rows = rowsToImport([sheet([[' EVENT ', 'Frekuensi', 'kategori', 'Tanggal Mulai'], ['Cek', 'Harian', 'Air', '2026-11-02']])]);
    expect(rows).toEqual([{ row: 2, category: 'Air', title: 'Cek', frequency: 'Harian', start: '2026-11-02' }]);
  });
  it('accepts the other names for event and frequency', () => {
    const rows = rowsToImport([sheet([['Outstanding', 'Due date'], ['Cek', '2027-01-15']])]);
    expect(rows[0]).toMatchObject({ title: 'Cek', frequency: '2027-01-15', category: null, start: null });
  });
  it('skips blank rows but keeps the Excel row number', () => {
    const rows = rowsToImport([sheet([['Event', 'Frekuensi'], ['A', 'Harian'], [], ['', ' '], ['B', 'Harian']])]);
    expect(rows.map((r) => [r.row, r.title])).toEqual([[2, 'A'], [5, 'B']]);
  });
  it('finds the header when it is not on the first row', () => {
    const rows = rowsToImport([sheet([['Daftar event 2026'], [], ['Event', 'Frekuensi'], ['A', 'Harian']])]);
    expect(rows).toEqual([{ row: 4, category: null, title: 'A', frequency: 'Harian', start: null }]);
  });
  it('prefers the sheet named Event, even when it is not first', () => {
    const rows = rowsToImport([sheet([['x']], 'Petunjuk'), sheet([['Event', 'Frekuensi'], ['A', 'Harian']])]);
    expect(rows).toHaveLength(1);
  });
  it('explains a file without the needed columns', () => {
    expect(() => rowsToImport([sheet([['Kategori', 'Catatan'], ['a', 'b']])])).toThrow('Kolom Event dan Frekuensi atau due date tidak ditemukan. Pakai templat.');
  });
  it('refuses more than 500 data rows', () => {
    const data = Array.from({ length: 501 }, (_, i) => [`E${i}`, 'Harian']);
    expect(() => rowsToImport([sheet([['Event', 'Frekuensi'], ...data])])).toThrow('Berkas harus berisi 1 sampai 500 baris.');
    expect(rowsToImport([sheet([['Event', 'Frekuensi'], ...data.slice(0, 500)])])).toHaveLength(500);
  });
});
