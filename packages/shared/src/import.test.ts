import { describe, it, expect } from 'vitest';
import { normalizeKey, parseDateCell, parseFrequencyCell, startDateInRange, validateImportRow, type ImportInputRow } from './import';

describe('normalizeKey', () => {
  it('trims, squeezes spaces and ignores case', () => expect(normalizeKey('  Air   Limbah ')).toBe('air limbah'));
});

describe('parseDateCell', () => {
  it('reads an Excel serial', () => expect(parseDateCell('46328')).toBe('2026-11-02'));
  it('reads DD/MM/YYYY and D/M/YYYY', () => {
    expect(parseDateCell('02/11/2026')).toBe('2026-11-02');
    expect(parseDateCell('2/11/2026')).toBe('2026-11-02');
  });
  it('reads ISO', () => expect(parseDateCell('2026-11-02')).toBe('2026-11-02'));
  it('rejects impossible or unreadable cells', () => {
    for (const bad of ['31/02/2026', 'abc', '', '5', '2026-13-01']) expect(parseDateCell(bad)).toBeNull();
  });
});

describe('parseFrequencyCell', () => {
  it('knows Indonesian and English names in any case', () => {
    expect(parseFrequencyCell('harian')).toEqual({ kind: 'frequency', frequency: 'Daily' });
    expect(parseFrequencyCell('3-Bulanan')).toEqual({ kind: 'frequency', frequency: 'Quarterly' });
    expect(parseFrequencyCell('semi-annual')).toEqual({ kind: 'frequency', frequency: 'Semi-Annual' });
    expect(parseFrequencyCell('  TAHUNAN ')).toEqual({ kind: 'frequency', frequency: 'Annual' });
  });
  it('a date means a one-off date', () => expect(parseFrequencyCell('15/01/2027')).toEqual({ kind: 'date', date: '2027-01-15' }));
  it('unknown text is null', () => expect(parseFrequencyCell('sering')).toBeNull());
});

describe('startDateInRange', () => {
  it('allows 2000-01-01 up to five years ahead', () => {
    expect(startDateInRange('2000-01-01', '2026-11-06')).toBe(true);
    expect(startDateInRange('2031-11-06', '2026-11-06')).toBe(true);
    expect(startDateInRange('1999-12-31', '2026-11-06')).toBe(false);
    expect(startDateInRange('2031-11-07', '2026-11-06')).toBe(false);
  });
});

describe('validateImportRow', () => {
  const TODAY = '2026-11-06';
  const row = (o: Partial<ImportInputRow> = {}): ImportInputRow => ({ row: 2, category: 'Air', title: 'Cek pompa', frequency: 'Bulanan', start: '2026-12-01', ...o });
  it('a recurring word needs and uses the start date', () =>
    expect(validateImportRow(row(), TODAY)).toEqual({ ok: true, title: 'Cek pompa', category: 'Air', frequency: 'Monthly', start_date: '2026-12-01' }));
  it('a date in the frequency cell becomes Annual from that date and ignores the start column', () =>
    expect(validateImportRow(row({ frequency: '15/01/2027', start: '2026-12-01' }), TODAY)).toEqual({ ok: true, title: 'Cek pompa', category: 'Air', frequency: 'Annual', start_date: '2027-01-15' }));
  it('blank category is null and spaces in the title are squeezed', () =>
    expect(validateImportRow(row({ category: '  ', title: ' Cek   pompa ' }), TODAY)).toMatchObject({ ok: true, category: null, title: 'Cek pompa' }));
  it('explains each failure', () => {
    const err = (o: Partial<ImportInputRow>) => (validateImportRow(row(o), TODAY) as { error: string }).error;
    expect(err({ start: null })).toBe('Tanggal mulai wajib diisi untuk frekuensi berulang.');
    expect(err({ start: 'bukan tanggal' })).toBe('Tanggal mulai wajib diisi untuk frekuensi berulang.');
    expect(err({ title: ' ' })).toBe('Judul wajib diisi.');
    expect(err({ title: 'x'.repeat(121) })).toBe('Judul maksimal 120 karakter.');
    expect(err({ frequency: null })).toBe('Frekuensi atau tanggal wajib diisi.');
    expect(err({ frequency: 'sering' })).toBe('Frekuensi tidak dikenal. Isi Harian, Mingguan, Bulanan, 3-Bulanan, 6-Bulanan, Tahunan, atau sebuah tanggal.');
    expect(err({ start: '1999-12-31' })).toBe('Tanggal harus antara 1 Jan 2000 dan 5 tahun dari sekarang.');
    expect(err({ frequency: '2032-01-01' })).toBe('Tanggal harus antara 1 Jan 2000 dan 5 tahun dari sekarang.');
  });
});
