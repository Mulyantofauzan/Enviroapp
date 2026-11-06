import { strFromU8, unzipSync } from 'fflate';

export type ReadSheet = { name: string; rows: string[][] };

const BAD = 'Berkas bukan .xlsx yang valid.';
const parseXml = (bytes: Uint8Array): Document => new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
const kids = (el: Element, name: string): Element[] => Array.from(el.getElementsByTagName(name));
const textOf = (el: Element): string => kids(el, 't').map((t) => t.textContent ?? '').join('');

/** 'C5' -> column index 2. */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Plain text of every sheet, row N at index N-1 and column C at index C-1; gaps are ''. Dates stay as the serial number Excel stored. */
export function readXlsx(bytes: Uint8Array): { sheets: ReadSheet[] } {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { throw new Error(BAD); }
  const wbBytes = files['xl/workbook.xml'];
  if (!wbBytes) throw new Error(BAD);

  const shared = files['xl/sharedStrings.xml']
    ? kids(parseXml(files['xl/sharedStrings.xml']).documentElement, 'si').map(textOf)
    : [];
  const rels = new Map<string, string>();
  if (files['xl/_rels/workbook.xml.rels']) {
    for (const r of kids(parseXml(files['xl/_rels/workbook.xml.rels']).documentElement, 'Relationship')) {
      const target = r.getAttribute('Target') ?? '';
      rels.set(r.getAttribute('Id') ?? '', target.startsWith('/') ? target.slice(1) : `xl/${target}`);
    }
  }

  const sheets: ReadSheet[] = [];
  for (const [i, el] of kids(parseXml(wbBytes).documentElement, 'sheet').entries()) {
    const rid = el.getAttribute('r:id') ?? el.getAttribute('id') ?? '';
    const path = rels.get(rid) ?? `xl/worksheets/sheet${i + 1}.xml`;
    const xml = files[path];
    if (!xml) continue;
    const rows: string[][] = [];
    for (const rowEl of kids(parseXml(xml).documentElement, 'row')) {
      const r = Number(rowEl.getAttribute('r')) || rows.length + 1;
      const cells: string[] = [];
      for (const c of kids(rowEl, 'c')) {
        const ref = c.getAttribute('r');
        if (!ref) continue;
        const type = c.getAttribute('t');
        const v = kids(c, 'v')[0]?.textContent ?? '';
        let value = v;
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') value = textOf(c);
        const at = colIndex(ref);
        while (cells.length < at) cells.push('');
        cells[at] = value;
      }
      while (rows.length < r - 1) rows.push([]);
      rows[r - 1] = cells;
    }
    sheets.push({ name: el.getAttribute('name') ?? `Sheet${i + 1}`, rows });
  }
  if (sheets.length === 0) throw new Error(BAD);
  return { sheets };
}
