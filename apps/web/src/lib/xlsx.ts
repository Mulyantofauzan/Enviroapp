import { strToU8, zipSync } from 'fflate';
import type { ReportSection } from './report';

export type ReportMeta = { title: string; lokasi: string; periode: string; dibuatOleh: string; dibuatPada: string };

/** Escapes the five XML characters and drops control characters XML cannot carry. */
export function xmlEscape(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Excel sheet names: at most 31 characters, none of []:*?/\, and unique within the workbook. */
export function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim() || 'Lembar').slice(0, 31);
  let out = base, n = 2;
  while (used.has(out.toLowerCase())) { const suffix = ` ${n++}`; out = base.slice(0, 31 - suffix.length) + suffix; }
  used.add(out.toLowerCase());
  return out;
}

const colName = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/** Cell styles are created on demand and shared. 0 default, 1 header, 2 bold title. */
class Styles {
  private xfs: { font: number; fill: number; fmt: number }[] = [{ font: 0, fill: 0, fmt: 0 }, { font: 1, fill: 2, fmt: 0 }, { font: 1, fill: 0, fmt: 0 }];
  private index = new Map<string, number>();
  for(decimals: number | undefined, bad: boolean): number {
    const fmt = decimals === 0 ? 1 : decimals === 1 ? 164 : decimals === 2 ? 2 : 0;
    const key = `${fmt}|${bad}`;
    if (fmt === 0 && !bad) return 0;
    let i = this.index.get(key);
    if (i === undefined) { i = this.xfs.length; this.xfs.push({ font: bad ? 2 : 0, fill: bad ? 3 : 0, fmt }); this.index.set(key, i); }
    return i;
  }
  xml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + `<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts>`
      + `<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>`
      + `<font><b/><sz val="11"/><color rgb="FFC62828"/><name val="Calibri"/></font></fonts>`
      + `<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>`
      + `<fill><patternFill patternType="solid"><fgColor rgb="FFE6F4F1"/><bgColor indexed="64"/></patternFill></fill>`
      + `<fill><patternFill patternType="solid"><fgColor rgb="FFFDE8E8"/><bgColor indexed="64"/></patternFill></fill></fills>`
      + `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>`
      + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
      + `<cellXfs count="${this.xfs.length}">${this.xfs.map((x) => `<xf numFmtId="${x.fmt}" fontId="${x.font}" fillId="${x.fill}" borderId="0" xfId="0" applyFont="1" applyFill="1"${x.fmt ? ' applyNumberFormat="1"' : ''}/>`).join('')}</cellXfs>`
      + `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

type CellDef = { v: string | number | null; s?: number };
const str = (ref: string, v: string, s = 0) => `<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ''}><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
const numCell = (ref: string, v: number, s = 0) => `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>`;

function sheetXml(rows: CellDef[][], opts: { freeze?: boolean; widths?: number[] }): string {
  const body = rows.map((cells, r) => {
    const out = cells.map((c, i) => {
      if (c.v === null || c.v === '') return '';
      const ref = `${colName(i)}${r + 1}`;
      return typeof c.v === 'number' ? numCell(ref, c.v, c.s) : str(ref, c.v, c.s);
    }).join('');
    return `<row r="${r + 1}">${out}</row>`;
  }).join('');
  const cols = opts.widths ? `<cols>${opts.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const view = opts.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${view}${cols}<sheetData>${body}</sheetData></worksheet>`;
}

const width = (texts: string[]) => Math.min(40, Math.max(8, ...texts.map((t) => t.length)) + 2);

export function buildXlsx(meta: ReportMeta, sections: ReportSection[]): Uint8Array {
  const styles = new Styles();
  const used = new Set<string>();
  const sheets: { name: string; xml: string }[] = [];

  const summary: CellDef[][] = [
    [{ v: meta.title, s: 2 }], [],
    [{ v: 'Lokasi', s: 2 }, { v: meta.lokasi }], [{ v: 'Periode', s: 2 }, { v: meta.periode }],
    [{ v: 'Dibuat oleh', s: 2 }, { v: meta.dibuatOleh }], [{ v: 'Dibuat pada', s: 2 }, { v: meta.dibuatPada }], [],
    [{ v: 'Bagian', s: 1 }, { v: 'Jumlah baris', s: 1 }],
    ...sections.map((s): CellDef[] => [{ v: s.title }, { v: s.rows.length }]),
  ];
  sheets.push({ name: sanitizeSheetName('Ringkasan', used), xml: sheetXml(summary, { widths: [16, Math.max(24, width([meta.lokasi, meta.periode, meta.dibuatOleh]))] }) });

  for (const sec of sections) {
    const rows: CellDef[][] = [sec.columns.map((c) => ({ v: c.header, s: 1 }))];
    for (const r of sec.rows) rows.push(sec.columns.map((c): CellDef => {
      const v = r.cells[c.key] ?? null;
      const bad = r.bad.includes(c.key);
      return { v, s: styles.for(typeof v === 'number' ? c.decimals : undefined, bad) };
    }));
    const widths = sec.columns.map((c, i) => width([c.header, ...rows.slice(1).map((r) => String(r[i].v ?? ''))]));
    sheets.push({ name: sanitizeSheetName(sec.title, used), xml: sheetXml(rows, { freeze: true, widths }) });
  }

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(styles.xml()),
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(s.xml); });
  return zipSync(files, { level: 6 });
}
