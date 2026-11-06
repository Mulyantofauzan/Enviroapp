import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readXlsx } from './xlsxRead';
import { buildImportTemplate } from './eventImport';

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
function handMade(sheetXml: string, shared?: string): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'xl/workbook.xml': strToU8(`<workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="/xl/worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet ${NS}><sheetData>${sheetXml}</sheetData></worksheet>`),
  };
  if (shared) files['xl/sharedStrings.xml'] = strToU8(`<sst ${NS}>${shared}</sst>`);
  return zipSync(files);
}

describe('readXlsx', () => {
  it('reads shared strings, numbers and leaves gaps empty', () => {
    const bytes = handMade(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>46328</v></c></row><row r="3"><c r="B3" t="s"><v>1</v></c></row>',
      '<si><t>teks</t></si><si><r><t>ri</t></r><r><t>ch</t></r></si>',
    );
    const [sheet] = readXlsx(bytes).sheets;
    expect(sheet.name).toBe('Data');
    expect(sheet.rows[0]).toEqual(['teks', '', '46328']);
    expect(sheet.rows[1]).toEqual([]);
    expect(sheet.rows[2]).toEqual(['', 'rich']);
  });
  it('reads inline strings, formula strings and escaped characters', () => {
    const bytes = handMade('<row r="1"><c r="A1" t="inlineStr"><is><t>A &amp; B</t></is></c><c r="B1" t="str"><v>hasil</v></c></row>');
    expect(readXlsx(bytes).sheets[0].rows[0]).toEqual(['A & B', 'hasil']);
  });
  it('round-trips the template this app writes', () => {
    const { sheets } = readXlsx(buildImportTemplate());
    expect(sheets.map((s) => s.name)).toEqual(['Event', 'Petunjuk']);
    expect(sheets[0].rows[0]).toEqual(['Kategori', 'Event', 'Frekuensi atau due date', 'Tanggal mulai']);
    expect(sheets[0].rows).toHaveLength(4);
  });
  it('refuses something that is not an xlsx', () => {
    expect(() => readXlsx(new Uint8Array([1, 2, 3, 4, 5]))).toThrow('Berkas bukan .xlsx yang valid.');
    expect(() => readXlsx(zipSync({ 'a.txt': strToU8('x') }))).toThrow('Berkas bukan .xlsx yang valid.');
  });
});
