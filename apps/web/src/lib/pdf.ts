import { cellText, type ReportKind, type ReportSection } from './report';
import type { ReportMeta } from './xlsx';

export type PdfChart = {
  section: ReportKind; title: string; dataUrl: string; width: number; height: number;
  legend: { label: string; color: string }[];
};

const WINANSI_EXTRA = new Set(['–', '—', '‘', '’', '“', '”', '•', '…', '€', '™']);

/** The built-in PDF font draws Latin text only: anything else becomes "?" and control characters go. */
export function pdfSafe(s: string): string {
  return Array.from(s).map((ch) => {
    const cp = ch.codePointAt(0)!;
    if (cp === 9) return ' ';
    if (cp < 32 || (cp >= 127 && cp < 160)) return '';
    return cp <= 0xff || WINANSI_EXTRA.has(ch) ? ch : '?';
  }).join('');
}

function rgb(color: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) { const n = parseInt(hex[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [120, 120, 120];
}

const MARGIN = 36;

/** A4 landscape report: header block, one table per section with its charts after it, page numbers. jspdf loads only when this runs. */
export async function buildPdf(meta: ReportMeta, sections: ReportSection[], charts: PdfChart[]): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = MARGIN + 8;

  const ensure = (need: number) => { if (y + need > pageH - MARGIN) { doc.addPage(); y = MARGIN + 8; } };

  doc.setFont('helvetica', 'bold').setFontSize(18).text(pdfSafe(meta.title), MARGIN, y);
  y += 20;
  doc.setFont('helvetica', 'normal').setFontSize(10);
  for (const [k, v] of [['Lokasi', meta.lokasi], ['Periode', meta.periode], ['Dibuat oleh', meta.dibuatOleh], ['Dibuat pada', meta.dibuatPada]]) {
    doc.text(pdfSafe(`${k}: ${v}`), MARGIN, y);
    y += 14;
  }
  y += 8;

  for (const sec of sections) {
    ensure(70);
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(0).text(pdfSafe(sec.title), MARGIN, y);
    y += 10;
    if (sec.rows.length === 0) {
      doc.setFont('helvetica', 'normal').setFontSize(10).text('Tidak ada data pada periode ini.', MARGIN, y + 8);
      y += 26;
    } else {
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN, bottom: MARGIN },
        head: [sec.columns.map((c) => pdfSafe(c.header))],
        body: sec.rows.map((r) => sec.columns.map((c) => pdfSafe(cellText(c, r.cells[c.key] ?? null)))),
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [14, 124, 102], textColor: 255 },
        showHead: 'everyPage',
        columnStyles: Object.fromEntries(sec.columns.map((c, i) => [i, { halign: c.kind === 'number' ? 'right' : 'left' } as const])),
        didParseCell: (d) => {
          if (d.section !== 'body') return;
          const col = sec.columns[d.column.index];
          if (sec.rows[d.row.index]?.bad.includes(col.key)) {
            d.cell.styles.textColor = [198, 40, 40];
            d.cell.styles.fontStyle = 'bold';
            d.cell.styles.fillColor = [253, 232, 232];
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
    }

    const mine = charts.filter((c) => c.section === sec.id);
    const slotW = (pageW - MARGIN * 2 - 20) / 2;
    for (let i = 0; i < mine.length; i += 2) {
      const pair = mine.slice(i, i + 2);
      const heights = pair.map((c) => (slotW * c.height) / c.width);
      ensure(Math.max(...heights) + 50);
      pair.forEach((c, j) => {
        const x = MARGIN + j * (slotW + 20);
        doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(0).text(pdfSafe(c.title), x, y);
        let lx = x;
        for (const l of c.legend) {
          doc.setFillColor(...rgb(l.color)).rect(lx, y + 6, 8, 8, 'F');
          doc.setFont('helvetica', 'normal').setFontSize(8).text(pdfSafe(l.label), lx + 11, y + 13);
          lx += 11 + doc.getTextWidth(pdfSafe(l.label)) + 12;
        }
        doc.addImage(c.dataUrl, 'PNG', x, y + 20, slotW, heights[j]);
      });
      y += Math.max(...heights) + 36;
    }
    y += 6;
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(100).text(`Halaman ${p} dari ${total}`, pageW - MARGIN, pageH - 16, { align: 'right' });
  }
  return doc.output('blob');
}
