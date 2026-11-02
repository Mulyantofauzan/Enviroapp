import { formatNumber } from '@evo/shared';
import { svgToPng } from '../chartImage';
import { cellText, type ReportSection } from '../report';
import type { PondPage, WeatherPage } from './pages';
import { pdfSafe } from './safe';
import { POND_THEME, WEATHER_THEME, barChartSvg, lineChartSvg, type Theme } from './svg';

export type SlideInput = { weather: WeatherPage | null; ponds: PondPage[]; event: ReportSection | null };
type Raster = (s: { xml: string; width: number; height: number }) => Promise<{ dataUrl: string; width: number; height: number }>;

const PAGE_W = 842, PAGE_H = 595, MARGIN = 28;
const BANNER_W = 300, BANNER_H = 30;
const RED = '#B02318', NAVY = '#14306B', YELLOW = '#F5B83D', PEACH = '#F3CDB8', LINE_RED = '#E5322D';
const SERIES_BLUE = '#4A90D9', BLACK = '#1A1A1A', GREY = '#E0E0E0';
const NO_DATA = 'Tidak ada data pada periode ini.';

const rgb = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const f1 = (v: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
const n1 = (v: number) => formatNumber(v, 1);

type Doc = import('jspdf').jsPDF;
type AutoTable = typeof import('jspdf-autotable').default;
const lastY = (doc: Doc) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

const MAX_BANNER_W = PAGE_W - MARGIN * 2;

/** Biggest font (17 down to 9 pt) that fits the standard box; else widen the box up to the page; else cut with "...". */
export function fitBanner(text: string, measure: (t: string, size: number) => number): { text: string; size: number; width: number } {
  const fits = (t: string, size: number, w: number) => measure(t, size) <= w - 16;
  for (let size = 17; size >= 9; size--) if (fits(text, size, BANNER_W)) return { text, size, width: BANNER_W };
  const need = Math.ceil(measure(text, 9)) + 16;
  if (need <= MAX_BANNER_W) return { text, size: 9, width: Math.max(BANNER_W, need) };
  let cut = text;
  while (cut.length > 1 && !fits(`${cut}...`, 9, MAX_BANNER_W)) cut = cut.slice(0, -1);
  return { text: `${cut}...`, size: 9, width: MAX_BANNER_W };
}

function drawBanner(doc: Doc, title: string, fill: string, y = MARGIN) {
  doc.setFont('helvetica', 'bolditalic');
  const fit = fitBanner(pdfSafe(title), (t, size) => doc.setFontSize(size).getTextWidth(t));
  const x = (PAGE_W - fit.width) / 2;
  doc.setFillColor(...rgb(fill)).rect(x, y, fit.width, BANNER_H, 'F');
  doc.setFontSize(fit.size).setTextColor(255).text(fit.text, PAGE_W / 2, y + BANNER_H / 2 + fit.size * 0.35, { align: 'center' });
}

async function addChart(doc: Doc, raster: Raster, xml: string, x: number, y: number, w: number, h: number) {
  const img = await raster({ xml, width: w, height: h });
  doc.addImage(img.dataUrl, 'PNG', x, y, w, h);
}

async function drawWeather(doc: Doc, autoTable: AutoTable, p: WeatherPage, raster: Raster) {
  drawBanner(doc, p.title, RED);
  const tableW = 440;
  const left = (PAGE_W - tableW) / 2;
  const s = p.summary;
  autoTable(doc, {
    startY: MARGIN + BANNER_H + 18,
    margin: { left, right: left },
    tableWidth: tableW,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3.5, halign: 'center', valign: 'middle', lineColor: rgb(RED), lineWidth: 0.6, textColor: 20 },
    headStyles: { fillColor: rgb(RED), textColor: 255, fontStyle: 'bolditalic' },
    head: [
      [{ content: 'Date', rowSpan: 2 }, { content: 'Weather', colSpan: 3 }],
      ['Rainfall (mm)', 'Duration (hrs)', 'Intensity (mm/hrs)'],
    ],
    body: [
      ...p.rows.map((r) => [r.date.slice(8, 10) + '-' + monthEn(r.date), f1(r.rain), f1(r.hours), f1(r.intensity)]),
      [`${s.rainyDays} hari hujan`, `${f1(s.rainMm)} mm`, `${f1(s.hours)} hrs`, `${f1(s.maxIntensity)} mm/hrs`],
    ],
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      const summary = d.row.index === p.rows.length;
      if (summary) { d.cell.styles.fillColor = rgb(YELLOW); d.cell.styles.fontStyle = 'bold'; return; }
      d.cell.styles.fillColor = d.column.index === 0 ? [255, 255, 255] : rgb(PEACH);
      if (d.column.index === 3) d.cell.styles.textColor = rgb(LINE_RED);
    },
  });

  const top = Math.max(lastY(doc) + 22, 270);
  const gap = 12, w = (PAGE_W - MARGIN * 2 - gap * 2) / 3, h = PAGE_H - MARGIN - top;
  const chart = (title: string, c: WeatherPage['w1'], names: [string, string], right: boolean) =>
    lineChartSvg({
      width: w, height: h, title, theme: WEATHER_THEME, categories: c.categories,
      series: [
        { name: names[0], color: LINE_RED, values: c.a },
        { name: names[1], color: NAVY, values: c.b, axis: right ? 'right' : 'left' },
      ],
    });
  await addChart(doc, raster, chart('Rainfall (1W)', p.w1, ['Rainfall (mm)', 'Duration (hrs)'], true), MARGIN, top, w, h);
  await addChart(doc, raster, chart('Rainfall (1M)', p.w5, ['Total Rainfall (mm)', 'Rain hours (hrs)'], false), MARGIN + w + gap, top, w, h);
  await addChart(doc, raster, chart('Rainfall (1Y)', p.m12, ['Total Rainfall (mm)', 'Rain hours (hrs)'], false), MARGIN + (w + gap) * 2, top, w, h);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthEn = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1];

function summaryTable(doc: Doc, autoTable: AutoTable, x: number, y: number, w: number, head: string[], rows: string[][]) {
  autoTable(doc, {
    startY: y,
    margin: { left: x, right: PAGE_W - x - w },
    tableWidth: w,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.2, halign: 'center', lineColor: [60, 60, 60], lineWidth: 0.4, textColor: 20 },
    headStyles: { fillColor: rgb(NAVY), textColor: 255, fontStyle: 'bolditalic' },
    columnStyles: { 0: { halign: 'left', cellWidth: 82 } },
    head: [head],
    body: rows,
    didParseCell: (d) => { if (d.section === 'body') d.cell.styles.fillColor = d.column.index === 0 ? [255, 255, 255] : rgb(GREY); },
  });
  return lastY(doc);
}

function totalsBox(doc: Doc, x: number, y: number, w: number, title: string, t: { kg: number; bags: number }) {
  const row = 13;
  doc.setFillColor(...rgb(NAVY)).rect(x, y, w, row, 'F');
  doc.setFont('helvetica', 'bolditalic').setFontSize(8).setTextColor(255).text(title, x + 4, y + 9.5);
  doc.setDrawColor(60, 60, 60).setLineWidth(0.4);
  [['Total (kg)', t.kg], ['Total (karung)', t.bags]].forEach(([label, v], i) => {
    const ry = y + row * (i + 1);
    doc.setFillColor(255, 255, 255).rect(x, ry, w * 0.5, row, 'FD');
    doc.setFillColor(...rgb(GREY)).rect(x + w * 0.5, ry, w * 0.5, row, 'FD');
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(20).text(String(label), x + 3, ry + 9);
    doc.setFont('helvetica', 'bold').text(n1(v as number), x + w - 4, ry + 9, { align: 'right' });
  });
}

async function drawPond(doc: Doc, autoTable: AutoTable, p: PondPage, raster: Raster) {
  drawBanner(doc, p.title, NAVY);
  const top = MARGIN + BANNER_H + 12, bottom = PAGE_H - MARGIN;
  const rightW = 230, gap = 10;
  const leftW = PAGE_W - MARGIN * 2 - rightW - 12;
  const pw = (leftW - gap) / 2, ph = (bottom - top - gap) / 2;
  const bar = (title: string, series: { name: string; color: string; values: (number | null)[] }[], decimals: number, lines?: { name: string; color: string; value: number }[]) =>
    barChartSvg({ width: pw, height: ph, title, theme: POND_THEME, categories: p.days.map((d) => d.slice(8, 10) + '-' + monthEn(d)), series, lines, decimals });

  const phLines = [
    ...(p.ph.min !== null ? [{ name: 'pH Min', color: LINE_RED, value: p.ph.min }] : []),
    ...(p.ph.max !== null ? [{ name: 'pH Max', color: LINE_RED, value: p.ph.max }] : []),
  ];
  const tssLines = p.tss.limit !== null ? [{ name: 'BML MHU', color: LINE_RED, value: p.tss.limit }] : [];
  await addChart(doc, raster, bar('pH Monitoring', [{ name: 'pH Inlet', color: NAVY, values: p.ph.inlet }, { name: 'pH Outlet', color: YELLOW, values: p.ph.outlet }], 1, phLines), MARGIN, top, pw, ph);
  await addChart(doc, raster, bar('TSS Monitoring', [{ name: 'TSS inlet (mg/l)', color: YELLOW, values: p.tss.inlet }, { name: 'TSS outlet (mg/l)', color: NAVY, values: p.tss.outlet }], 0, tssLines), MARGIN + pw + gap, top, pw, ph);
  await addChart(doc, raster, bar('Debit Inlet & Outlet', [{ name: 'Debit Inlet (L/S)', color: SERIES_BLUE, values: p.debit.inlet }, { name: 'Debit Outlet (L/S)', color: BLACK, values: p.debit.outlet }], 1), MARGIN, top + ph + gap, pw, ph);
  await addChart(doc, raster, bar('Jenis & Qty Koagulan (kg)', [{ name: 'Tawas Batu (kg)', color: NAVY, values: p.coag.batu }, { name: 'Tawas Serbuk (kg)', color: YELLOW, values: p.coag.serbuk }], 0), MARGIN + pw + gap, top + ph + gap, pw, ph);

  const x = PAGE_W - MARGIN - rightW;
  let y = top;
  doc.setFillColor(...rgb(NAVY)).rect(x, y, rightW, 16, 'F');
  doc.setFont('helvetica', 'bolditalic').setFontSize(9).setTextColor(255).text('Summary Penggunaan Koagulan', x + 5, y + 11.5);
  y += 16;
  y = summaryTable(doc, autoTable, x, y, rightW, ['WEEKLY', ...p.weekly.labels], [
    ['Total Tawas (kg)', ...p.weekly.totalKg.map(n1)],
    ['Total (karung)', ...p.weekly.bags.map(n1)],
    ['Average per day (kg)', ...p.weekly.avgPerDay.map(n1)],
  ]) + 4;
  const chartH = 158;
  await addChart(doc, raster, lineChartSvg({ width: rightW, height: chartH, title: 'Penggunaan Koagulan MTD', theme: POND_THEME, categories: p.weekly.labels, legend: false, decimals: 0, series: [{ name: 'Total Tawas (kg)', color: NAVY, values: p.weekly.chart }] }), x, y, rightW, chartH);
  y += chartH + 4;
  y = summaryTable(doc, autoTable, x, y, rightW, ['MONTHLY', ...p.monthly.labels], [
    ['Total (kg)', ...p.monthly.totalKg.map(n1)],
    ['Total (karung)', ...p.monthly.bags.map(n1)],
  ]) + 4;
  await addChart(doc, raster, lineChartSvg({ width: rightW, height: chartH, title: 'Grafik Koagulan YTD', theme: POND_THEME, categories: p.ytdChart.labels, legend: false, decimals: 0, series: [{ name: 'Total Tawas (kg)', color: NAVY, values: p.ytdChart.values }] }), x, y, rightW, chartH);
  y += chartH + 4;
  const bw = (rightW - 6) / 2;
  totalsBox(doc, x, y, bw, 'Year To Date', p.ytd);
  totalsBox(doc, x + bw + 6, y, bw, 'Project To Date', p.project);
}

function drawEvent(doc: Doc, autoTable: AutoTable, sec: ReportSection) {
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(0).text('EVENT', MARGIN, MARGIN + 8);
  autoTable(doc, {
    startY: MARGIN + 18,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN + 14 },
    head: [sec.columns.map((c) => pdfSafe(c.header))],
    body: sec.rows.map((r) => sec.columns.map((c) => pdfSafe(cellText(c, r.cells[c.key] ?? null)))),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [14, 124, 102], textColor: 255 },
    showHead: 'everyPage',
  });
}

/** Slide-style A4 landscape report drawn straight from data. jspdf loads only when this runs. */
export async function buildSlidePdf(input: SlideInput, rasterize: Raster = (s) => svgToPng(s, 3)): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
  let started = false;
  const next = () => { if (started) doc.addPage(); started = true; };

  if (input.weather) { next(); await drawWeather(doc, autoTable, input.weather, rasterize); }
  for (const p of input.ponds) { next(); await drawPond(doc, autoTable, p, rasterize); }
  if (input.event && input.event.rows.length > 0) {
    next();
    const first = doc.getNumberOfPages();
    drawEvent(doc, autoTable, input.event);
    const total = doc.getNumberOfPages();
    for (let p = first; p <= total; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(100).text(`Halaman ${p - first + 1} dari ${total - first + 1}`, PAGE_W - MARGIN, PAGE_H - 16, { align: 'right' });
    }
  }
  if (!started) doc.setFont('helvetica', 'normal').setFontSize(12).setTextColor(0).text(NO_DATA, MARGIN, MARGIN + 12);
  return doc.output('blob');
}
