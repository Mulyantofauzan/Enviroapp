import { describe, it, expect } from 'vitest';
import { isBlankCell, parseFlexibleNumber, validateDailyRow, type DailyInputRow } from './daily-import';

const TODAY = '2026-11-07';
const blank: DailyInputRow = {
  row: 2, date: '2026-04-01', pond: 'SP11', rainfall: null, rain_hours: null,
  ph_inlet: null, ph_outlet: null, tss_inlet: null, tss_outlet: null, debit_inlet: null, debit_outlet: null,
  serbuk_in: null, serbuk_out: null, batu_in: null, batu_out: null, kapur_in: null, kapur_out: null,
};
const row = (o: Partial<DailyInputRow> = {}): DailyInputRow => ({ ...blank, ...o });
const ok = (o: Partial<DailyInputRow> = {}) => {
  const r = validateDailyRow(row(o), TODAY);
  if (!r.ok) throw new Error(r.error);
  return r;
};
const err = (o: Partial<DailyInputRow>) => {
  const r = validateDailyRow(row(o), TODAY);
  if (r.ok) throw new Error('expected an error');
  return r.error;
};

describe('isBlankCell', () => {
  it.each([null, '', '  ', 'no data', 'No Flow', 'NO DATA', '-'])('%s is blank', (v) => expect(isBlankCell(v)).toBe(true));
  it.each(['0', '7,2', 'abc'])('%s is not blank', (v) => expect(isBlankCell(v)).toBe(false));
});

describe('parseFlexibleNumber', () => {
  it.each([
    ['0,0', 0], ['1,5', 1.5], ['1234', 1234], ['1234.5', 1234.5], ['1.234,5', 1234.5], ['1,234.5', 1234.5],
    ['1.234.567', 1234567], ['1.234', 1.234], ['  7,2 ', 7.2], ['-3', -3],
  ])('%s -> %s', (raw, n) => expect(parseFlexibleNumber(raw)).toBe(n));
  it.each(['1,2,3', '12a', 'abc', '1.2.3,4,5', ''])('%s is invalid', (raw) => expect(parseFlexibleNumber(raw)).toBe('invalid'));
});

describe('validateDailyRow: keys', () => {
  it('needs a date', () => expect(err({ date: null })).toBe('Tanggal wajib diisi.'));
  it('rejects an unreadable date', () => expect(err({ date: '1-Apr' })).toBe('Tanggal tidak dikenali.'));
  it('rejects a future date', () => expect(err({ date: '2026-11-08' })).toBe('Tanggal tidak boleh di masa depan.'));
  it('accepts today', () => expect(ok({ date: TODAY }).date).toBe(TODAY));
  it('rejects dates before 2000', () => expect(err({ date: '1999-12-31' })).toBe('Tanggal tidak boleh sebelum 1 Jan 2000.'));
  it('reads an Excel serial and a D/M/YYYY date', () => {
    expect(ok({ date: '46113' }).date).toBe('2026-04-01');
    expect(ok({ date: '01/04/2026' }).date).toBe('2026-04-01');
  });
  it('needs a pond and trims it', () => {
    expect(err({ pond: null })).toBe('Pond wajib diisi.');
    expect(ok({ pond: '  SP11 ' }).pond).toBe('SP11');
  });
});

describe('validateDailyRow: values', () => {
  it('empty and text markers become null', () => {
    const r = ok({ rainfall: 'no data', ph_outlet: 'No Flow', tss_outlet: '' });
    expect(r.weather).toEqual({ rainfall_mm: null, rain_hours: null });
    expect(r.water.ph_outlet).toBeNull();
    expect(r.water.tss_outlet).toBeNull();
  });
  it('reads Indonesian decimals and thousands', () => {
    const r = ok({ rainfall: '0,0', tss_inlet: '1.234,5', ph_inlet: '7,2' });
    expect(r.weather.rainfall_mm).toBe(0);
    expect(r.water.tss_inlet).toBe(1234.5);
    expect(r.water.ph_inlet).toBe(7.2);
  });
  it('names the column for text that is not a number', () => {
    expect(err({ ph_inlet: 'abc' })).toBe('pH inlet harus berupa angka.');
    expect(err({ tss_outlet: 'x' })).toBe('TSS outlet harus berupa angka.');
    expect(err({ kapur_out: '1,2,3' })).toBe('Kapur keluar harus berupa angka.');
  });
  it('keeps pH within 0..14 and everything else non-negative', () => {
    expect(err({ ph_outlet: '15' })).toBe('pH outlet harus antara 0 dan 14.');
    expect(err({ ph_inlet: '-1' })).toBe('pH inlet harus antara 0 dan 14.');
    expect(err({ tss_inlet: '-1' })).toBe('TSS inlet harus 0 atau lebih.');
    expect(err({ rain_hours: '25' })).toBe('Jam hujan harus antara 0 dan 24.');
    expect(err({ serbuk_in: '-5' })).toBe('Tawas Serbuk masuk harus 0 atau lebih.');
  });
  it('converts L/s debit to m3/s', () => {
    const r = ok({ debit_inlet: '500', debit_outlet: '250' });
    expect(r.water.debit_inlet_m3s).toBe(0.5);
    expect(r.water.debit_outlet_m3s).toBe(0.25);
  });
  it('keeps a zero outlet debit (no flow) and zero pH', () => {
    const r = ok({ debit_outlet: '0', ph_outlet: '0' });
    expect(r.water.debit_outlet_m3s).toBe(0);
    expect(r.water.ph_outlet).toBe(0);
  });
});

describe('validateDailyRow: coagulant', () => {
  it('lists only the types that have a cell filled', () => {
    const r = ok({ serbuk_out: '50', batu_in: '25', batu_out: '10' });
    expect(r.coagulant).toEqual({ 'Tawas Serbuk': { stock_in: null, stock_out: 50 }, 'Tawas Batu': { stock_in: 25, stock_out: 10 } });
    expect(r.coagulant.Kapur).toBeUndefined();
  });
  it('is empty when no coagulant cell is filled', () => expect(ok().coagulant).toEqual({}));
});
