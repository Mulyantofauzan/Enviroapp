import { describe, it, expect } from 'vitest';
import { buildWaReport, longDate, weatherText, whatsappUrl, witaTime, type WaExtras } from './waReport';

const extras: WaExtras = { places: [{ label: 'SP-11', sack: '0' }, { label: 'CB-2', sack: '2' }], batu: '0', serbuk: '1', remain: '289', pintu: 'Terbuka', pompa: '' };
const water = { ph_inlet: 6, ph_outlet: 6, tss_inlet: 28, tss_outlet: 48, debit_inlet_m3s: null, debit_outlet_m3s: 0.00441 };
const base = { title: 'SP-11 Settling Pond', date: '2026-11-09', time: '10:30', weather: { rainfall_mm: 0 }, water, extras };

describe('waReport', () => {
  it('formats the date and the WITA time', () => {
    expect(longDate('2026-11-09')).toBe('Senin 9 November 2026');
    expect(witaTime(new Date('2026-11-09T02:30:00Z'))).toBe('10:30');
  });
  it('derives the weather from rainfall', () => {
    expect(weatherText({ rainfall_mm: 0 })).toBe('Cerah');
    expect(weatherText({ rainfall_mm: 4.5 })).toBe('Hujan (4,5 mm)');
    expect(weatherText(null)).toBe('-');
  });
  it('fills the template from the saved data', () => {
    const t = buildWaReport(base);
    for (const s of ['*Pengelolaan Kualitas Air*', '*SP-11 Settling Pond*', 'Periode : Senin 9 November 2026', 'Jam : 10:30 WITA', 'Cuaca : Cerah',
      '• TSS Inlet : 28 mg/L', '• TSS Outlet : 48 mg/L', '• pH Outlet : 6', '• Debit Inlet : -', '• Debit Outlet : 4,41 L/s',
      '• SP-11 : 0 sack', '• CB-2 : 2 sack', '• Serbuk : 1 sack', 'Remain : 289 sack', '• Pintu air : Terbuka', 'Demikian dilaporkan.']) expect(t).toContain(s);
    expect(t).not.toContain('Pompa');
  });
  it('writes (No flow) on a no-flow day and a dash for missing readings', () => {
    const t = buildWaReport({ ...base, water: { ph_inlet: null, ph_outlet: null, tss_inlet: null, tss_outlet: null, debit_inlet_m3s: null, debit_outlet_m3s: 0 } });
    expect(t).toContain('• TSS Inlet : (No flow)');
    expect(t).toContain('• TSS Outlet : (No flow)');
    expect(t).toContain('• pH Inlet : -');
    expect(t).toContain('• Debit Outlet : (No flow)');
  });
  it('omits empty optional lines and skips unnamed places', () => {
    const t = buildWaReport({ ...base, extras: { ...extras, places: [{ label: 'SP-11', sack: '1' }, { label: '', sack: '0' }], pintu: '', remain: '', pompa: 'Hidup' } });
    expect(t).toContain('Pompa : Hidup');
    expect(t).not.toContain('Pintu air');
    expect(t).toContain('Remain : -');
    expect(t.match(/ sack/g)!.length).toBe(3);
  });
  it('builds a wa.me link with the encoded text', () => {
    expect(whatsappUrl('a b\n*c*')).toBe('https://wa.me/?text=a%20b%0A*c*');
  });
});
