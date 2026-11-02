import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildXlsx, sanitizeSheetName, xmlEscape, type ReportMeta } from './xlsx';
import type { ReportSection } from './report';

const meta: ReportMeta = { title: 'Laporan EVO', lokasi: 'SP-02 Pit Selatan', periode: '1 Okt 2026 - 2 Nov 2026', dibuatOleh: 'Budi & Co', dibuatPada: '2 Nov 2026 08:21' };
const air: ReportSection = {
  id: 'air', title: 'Air Permukaan',
  columns: [{ key: 'date', header: 'Tanggal', kind: 'text' }, { key: 'pho', header: 'pH outlet', kind: 'number', decimals: 2 }, { key: 'tsso', header: 'TSS outlet', kind: 'number' }],
  rows: [{ cells: { date: '2 Nov 2026', pho: 5.8, tsso: null }, bad: ['pho'] }, { cells: { date: '1 Nov 2026', pho: 7, tsso: 30 }, bad: [] }],
};
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const files = (b: Uint8Array) => unzipSync(b);
const read = (f: Record<string, Uint8Array>, name: string) => parse(strFromU8(f[name]));
const noErr = (d: Document) => expect(d.getElementsByTagName('parsererror')).toHaveLength(0);

describe('buildXlsx structure', () => {
  const f = files(buildXlsx(meta, [air, { ...air, id: 'cuaca', title: 'Cuaca', rows: [] }]));
  it('has every part of a valid minimal workbook, all well-formed XML', () => {
    for (const n of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml']) {
      expect(f[n], n).toBeDefined();
      noErr(read(f, n));
    }
  });
  it('sheet 1 is Ringkasan, then one sheet per section in order', () => {
    const names = [...read(f, 'xl/workbook.xml').getElementsByTagName('sheet')].map((s) => s.getAttribute('name'));
    expect(names).toEqual(['Ringkasan', 'Air Permukaan', 'Cuaca']);
  });
  it('the summary carries the meta and one count per section', () => {
    const t = strFromU8(f['xl/worksheets/sheet1.xml']);
    for (const s of ['Laporan EVO', 'SP-02 Pit Selatan', '1 Okt 2026 - 2 Nov 2026', 'Budi &amp; Co', '2 Nov 2026 08:21', 'Air Permukaan']) expect(t).toContain(s);
  });
  it('a section with zero rows still has its header row', () => {
    const rows = read(f, 'xl/worksheets/sheet3.xml').getElementsByTagName('row');
    expect(rows).toHaveLength(1);
  });
  it('the header row is frozen', () => {
    expect(strFromU8(f['xl/worksheets/sheet2.xml'])).toContain('state="frozen"');
  });
});

describe('buildXlsx cells', () => {
  const f = files(buildXlsx(meta, [air]));
  const sheet = read(f, 'xl/worksheets/sheet2.xml');
  const cell = (ref: string) => [...sheet.getElementsByTagName('c')].find((c) => c.getAttribute('r') === ref);
  it('numbers are real numbers, strings are inline strings, nulls are not written', () => {
    const n = cell('B2')!;
    expect(n.getAttribute('t')).toBeNull();
    expect(n.getElementsByTagName('v')[0].textContent).toBe('5.8');
    expect(cell('A2')!.getAttribute('t')).toBe('inlineStr');
    expect(cell('C2')).toBeUndefined();
    expect(cell('C3')!.getElementsByTagName('v')[0].textContent).toBe('30');
  });
  it('out-of-limit cells use a red bold style, others do not', () => {
    const styles = read(f, 'xl/styles.xml');
    const xfs = [...styles.getElementsByTagName('cellXfs')[0].getElementsByTagName('xf')];
    const fonts = [...styles.getElementsByTagName('fonts')[0].getElementsByTagName('font')];
    const fontOf = (ref: string) => fonts[Number(xfs[Number(cell(ref)!.getAttribute('s') ?? 0)].getAttribute('fontId'))];
    expect(fontOf('B2').getElementsByTagName('color')[0]?.getAttribute('rgb')).toBe('FFC62828');
    expect(fontOf('B2').getElementsByTagName('b')).toHaveLength(1);
    expect(fontOf('B3').getElementsByTagName('color')).toHaveLength(0);
  });
  it('header cells are bold', () => {
    const styles = read(f, 'xl/styles.xml');
    const xfs = [...styles.getElementsByTagName('cellXfs')[0].getElementsByTagName('xf')];
    const fonts = [...styles.getElementsByTagName('fonts')[0].getElementsByTagName('font')];
    const font = fonts[Number(xfs[Number(cell('A1')!.getAttribute('s'))].getAttribute('fontId'))];
    expect(font.getElementsByTagName('b')).toHaveLength(1);
  });
});

describe('escaping and names', () => {
  it('special characters survive a round trip, control characters are dropped', () => {
    const tricky: ReportSection = { ...air, rows: [{ cells: { date: 'A & B <x> "q" \'s\' ☃ 😀\u0001', pho: 1, tsso: 1 }, bad: [] }] };
    const f = files(buildXlsx(meta, [tricky]));
    const d = read(f, 'xl/worksheets/sheet2.xml');
    noErr(d);
    const a2 = [...d.getElementsByTagName('c')].find((c) => c.getAttribute('r') === 'A2')!;
    expect(a2.textContent).toBe('A & B <x> "q" \'s\' ☃ 😀');
  });
  it('xmlEscape covers the five characters', () => {
    expect(xmlEscape(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &apos;');
  });
  it('sheet names: no forbidden characters, at most 31 long, unique', () => {
    const used = new Set<string>();
    const a = sanitizeSheetName('A/B:C*?[x]\\', used);
    expect(a).not.toMatch(/[\[\]:*?/\\]/);
    expect(sanitizeSheetName('x'.repeat(50), used).length).toBeLessThanOrEqual(31);
    const one = sanitizeSheetName('Event', used);
    const two = sanitizeSheetName('Event', used);
    expect(one).not.toBe(two);
    expect(sanitizeSheetName('', used).length).toBeGreaterThan(0);
  });
  it('two sections with the same title get different sheet names', () => {
    const f = files(buildXlsx(meta, [air, air]));
    const names = [...read(f, 'xl/workbook.xml').getElementsByTagName('sheet')].map((s) => s.getAttribute('name'));
    expect(new Set(names).size).toBe(3);
  });
});
