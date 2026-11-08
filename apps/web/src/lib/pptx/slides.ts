import { formatNumber } from '@evo/shared';
import { cellText, type ReportSection } from '../report';
import type { PondPage, Pt, WeatherPage } from '../pdf/pages';
import type { SlideInput } from '../pdf/slides';

/** Same colors as the PDF slides, without "#" as PowerPoint wants them. */
const RED = 'B02318', NAVY = '14306B', YELLOW = 'F5B83D', PEACH = 'F3CDB8', LINE_RED = 'E5322D';
const SERIES_BLUE = '4A90D9', BLACK = '1A1A1A', GREY = 'E0E0E0', WHITE = 'FFFFFF';
const WEATHER_PANEL = 'F8E4D8', WEATHER_BORDER = 'D9261C', POND_PANEL = 'D6E8C2', POND_BORDER = '7DB04B';
const NO_DATA = 'Tidak ada data pada periode ini.';

/** Slide size is A4 landscape, the same page as the PDF; positions below are the PDF's points divided by 72. */
const W = 842 / 72, H = 595 / 72, M = 28 / 72;
const pt = (v: number) => v / 72;
const FONT = 'Arial';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonthEn = (d: string) => `${d.slice(8, 10)}-${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const f1 = (v: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
const n1 = (v: number) => formatNumber(v, 1);
/** Empty points would make an empty value cell in the chart data; a missing reading is drawn as zero, like the empty bar in the PDF. */
const num = (v: Pt) => v ?? 0;

type Pptx = import('pptxgenjs').default;
type Slide = import('pptxgenjs').default.Slide;
type Cell = import('pptxgenjs').default.TableCell;
type Row = Cell[];

const cell = (text: string, o: Partial<NonNullable<Cell['options']>> = {}): Cell => ({ text, options: { fontFace: FONT, ...o } });

function banner(pptx: Pptx, slide: Slide, title: string, fill: string) {
  const w = Math.min(W - M * 2, Math.max(pt(300), title.length * 0.13 + 0.5));
  slide.addText(title, {
    x: (W - w) / 2, y: M, w, h: pt(30), align: 'center', valign: 'middle', bold: true, italic: true,
    color: WHITE, fontFace: FONT, fontSize: title.length > 28 ? 12 : 17, fill: { color: fill }, shrinkText: true,
  });
}

type ChartDef = {
  slide: Slide; pptx: Pptx; title: string; categories: string[]; x: number; y: number; w: number; h: number;
  panel: string; border: string; tag: string; decimals?: number;
};
type Ser = { name: string; color: string; values: Pt[] };

function baseOpts(c: ChartDef) {
  const fmt = c.decimals ? `#,##0.${'0'.repeat(c.decimals)}` : '#,##0';
  return {
    x: c.x, y: c.y, w: c.w, h: c.h,
    showTitle: true, title: c.title, titleColor: WHITE, titleFontSize: 11, titleFontFace: FONT, titleBold: true,
    showLegend: true, legendPos: 'b' as const, legendFontSize: 8, legendFontFace: FONT,
    catAxisLabelFontSize: 7, catAxisLabelFontFace: FONT, valAxisLabelFontSize: 7, valAxisLabelFontFace: FONT,
    valAxisLabelFormatCode: fmt, valGridLine: { color: '9AA39A', size: 0.5, style: 'solid' as const },
    chartArea: { fill: { color: c.panel }, border: { pt: 1, color: c.border } },
    plotArea: { fill: { color: c.panel } },
  };
}

/** The title sits on a colored tag in the PDF; here the tag is a text box over the top of the chart. */
function tag(c: ChartDef) {
  const tw = Math.min(c.w - 0.3, c.title.length * 0.09 + 0.3);
  c.slide.addText(c.title, {
    x: c.x + (c.w - tw) / 2, y: c.y + 0.04, w: tw, h: 0.26, align: 'center', valign: 'middle', bold: true,
    color: WHITE, fontFace: FONT, fontSize: 10, fill: { color: c.tag },
  });
}

/** pptxgenjs takes a multi-type chart as (types, options); its typings only describe the single-type call. */
type Combo = { type: import('pptxgenjs').default.CHART_NAME; data: object[]; options: object }[];
const addCombo = (slide: Slide, parts: Combo, opts: object) => (slide.addChart as unknown as (a: Combo, b: object) => void)(parts, opts);

function barChart(c: ChartDef, series: Ser[], lines: { name: string; color: string; value: number }[] = []) {
  const bars = series.map((s) => ({ name: s.name, labels: c.categories, values: s.values.map(num) }));
  const opts = { ...baseOpts(c), showTitle: false, chartColors: series.map((s) => s.color) };
  if (lines.length === 0) {
    c.slide.addChart(c.pptx.ChartType.bar, bars, { ...opts, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60 });
  } else {
    const ln = lines.map((l) => ({ name: l.name, labels: c.categories, values: c.categories.map(() => l.value) }));
    addCombo(c.slide, [
      { type: c.pptx.ChartType.bar, data: bars, options: { barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60, chartColors: series.map((s) => s.color) } },
      { type: c.pptx.ChartType.line, data: ln, options: { chartColors: lines.map((l) => l.color), lineSize: 2, lineDataSymbol: 'none' } },
    ], opts);
  }
  tag(c);
}

function lineChart(c: ChartDef, series: Ser[], o: { rightAxisFor?: number; legend?: boolean } = {}) {
  const data = series.map((s) => ({ name: s.name, labels: c.categories, values: s.values.map(num) }));
  const opts = { ...baseOpts(c), showTitle: false, showLegend: o.legend !== false, chartColors: series.map((s) => s.color), lineSize: 2, lineDataSymbol: 'none' as const };
  if (o.rightAxisFor === undefined) {
    c.slide.addChart(c.pptx.ChartType.line, data, opts);
  } else {
    const right = o.rightAxisFor;
    addCombo(
      c.slide,
      data.map((d, i) => ({
        type: c.pptx.ChartType.line, data: [d],
        options: { chartColors: [series[i].color], lineSize: 2, lineDataSymbol: 'none' as const, ...(i === right ? { secondaryValAxis: true, secondaryCatAxis: true } : {}) },
      })),
      { ...opts, valAxes: [{ valAxisLabelFormatCode: opts.valAxisLabelFormatCode }, { valAxisLabelFormatCode: opts.valAxisLabelFormatCode, valGridLine: { style: 'none' } }], catAxes: [{ catAxisLabelFontSize: 7 }, { catAxisHidden: true }] },
    );
  }
  tag(c);
}

function weatherSlide(pptx: Pptx, p: WeatherPage) {
  const slide = pptx.addSlide();
  banner(pptx, slide, p.title, RED);
  const s = p.summary;
  const border = { type: 'solid' as const, color: RED, pt: 0.6 };
  const base = { align: 'center' as const, valign: 'middle' as const, fontSize: 8.5, border, color: '141414' };
  const head = { ...base, bold: true, italic: true, color: WHITE, fill: { color: RED } };
  const rows: Row[] = [
    [cell('Date', { ...head, rowspan: 2 }), cell('Weather', { ...head, colspan: 3 })],
    [cell('Rainfall (mm)', head), cell('Duration (hrs)', head), cell('Intensity (mm/hrs)', head)],
    ...p.rows.map((r): Row => [
      cell(dayMonthEn(r.date), { ...base, fill: { color: WHITE } }),
      cell(f1(r.rain), { ...base, fill: { color: PEACH } }),
      cell(f1(r.hours), { ...base, fill: { color: PEACH } }),
      cell(f1(r.intensity), { ...base, fill: { color: PEACH }, color: LINE_RED }),
    ]),
    [`${s.rainyDays} hari hujan`, `${f1(s.rainMm)} mm`, `${f1(s.hours)} hrs`, `${f1(s.maxIntensity)} mm/hrs`]
      .map((t) => cell(t, { ...base, bold: true, fill: { color: YELLOW } })),
  ];
  const tableW = pt(440);
  slide.addTable(rows, { x: (W - tableW) / 2, y: M + pt(30) + pt(18), w: tableW, colW: [tableW * 0.25, tableW * 0.25, tableW * 0.25, tableW * 0.25], rowH: pt(17) });

  const top = pt(300), gap = pt(12), w = (W - M * 2 - gap * 2) / 3, h = H - M - top;
  const base2 = { slide, pptx, y: top, w, h, panel: WEATHER_PANEL, border: WEATHER_BORDER, tag: LINE_RED };
  lineChart({ ...base2, title: 'Rainfall (1W)', categories: p.w1.categories, x: M }, [
    { name: 'Rainfall (mm)', color: LINE_RED, values: p.w1.a }, { name: 'Duration (hrs)', color: NAVY, values: p.w1.b },
  ], { rightAxisFor: 1 });
  lineChart({ ...base2, title: 'Rainfall (1M)', categories: p.w5.categories, x: M + w + gap }, [
    { name: 'Total Rainfall (mm)', color: LINE_RED, values: p.w5.a }, { name: 'Rain hours (hrs)', color: NAVY, values: p.w5.b },
  ]);
  lineChart({ ...base2, title: 'Rainfall (1Y)', categories: p.m12.categories, x: M + (w + gap) * 2 }, [
    { name: 'Total Rainfall (mm)', color: LINE_RED, values: p.m12.a }, { name: 'Rain hours (hrs)', color: NAVY, values: p.m12.b },
  ]);
}

function summaryTable(slide: Slide, x: number, y: number, w: number, head: string[], rows: string[][]): number {
  const border = { type: 'solid' as const, color: '3C3C3C', pt: 0.4 };
  const base = { align: 'center' as const, valign: 'middle' as const, fontSize: 7.5, border, color: '141414' };
  const first = w * 0.36;
  const rest = (w - first) / (head.length - 1);
  const rowH = pt(14);
  const body: Row[] = [
    head.map((t) => cell(t, { ...base, bold: true, italic: true, color: WHITE, fill: { color: NAVY } })),
    ...rows.map((r): Row => r.map((t, i) => cell(t, { ...base, align: i === 0 ? 'left' : 'center', fill: { color: i === 0 ? WHITE : GREY } }))),
  ];
  slide.addTable(body, { x, y, w, colW: [first, ...Array(head.length - 1).fill(rest)], rowH });
  return y + rowH * body.length;
}

function totalsBox(slide: Slide, x: number, y: number, w: number, title: string, t: { kg: number; bags: number }) {
  const border = { type: 'solid' as const, color: '3C3C3C', pt: 0.4 };
  const base = { fontSize: 7.5, valign: 'middle' as const, border, color: '141414' };
  slide.addTable([
    [cell(title, { ...base, colspan: 2, bold: true, italic: true, color: WHITE, fill: { color: NAVY } })],
    [cell('Total (kg)', { ...base, fill: { color: WHITE } }), cell(n1(t.kg), { ...base, bold: true, align: 'right', fill: { color: GREY } })],
    [cell('Total (karung)', { ...base, fill: { color: WHITE } }), cell(n1(t.bags), { ...base, bold: true, align: 'right', fill: { color: GREY } })],
  ], { x, y, w, colW: [w / 2, w / 2], rowH: pt(14) });
}

function pondSlide(pptx: Pptx, p: PondPage) {
  const slide = pptx.addSlide();
  banner(pptx, slide, p.title, NAVY);
  const top = M + pt(30) + pt(12), bottom = H - M;
  const rightW = pt(230), gap = pt(10);
  const leftW = W - M * 2 - rightW - pt(12);
  const pw = (leftW - gap) / 2, ph = (bottom - top - gap) / 2;
  const cats = p.days.map(dayMonthEn);
  const base = { slide, pptx, w: pw, h: ph, panel: POND_PANEL, border: POND_BORDER, tag: NAVY, categories: cats };

  const phLines = [
    ...(p.ph.min !== null ? [{ name: 'pH Min', color: LINE_RED, value: p.ph.min }] : []),
    ...(p.ph.max !== null ? [{ name: 'pH Max', color: LINE_RED, value: p.ph.max }] : []),
  ];
  const tssLines = p.tss.limit !== null ? [{ name: 'BML MHU', color: LINE_RED, value: p.tss.limit }] : [];
  barChart({ ...base, title: 'pH Monitoring', x: M, y: top, decimals: 1 }, [{ name: 'pH Inlet', color: NAVY, values: p.ph.inlet }, { name: 'pH Outlet', color: YELLOW, values: p.ph.outlet }], phLines);
  barChart({ ...base, title: 'TSS Monitoring', x: M + pw + gap, y: top }, [{ name: 'TSS inlet (mg/l)', color: YELLOW, values: p.tss.inlet }, { name: 'TSS outlet (mg/l)', color: NAVY, values: p.tss.outlet }], tssLines);
  barChart({ ...base, title: `Debit Inlet & Outlet${p.noFlowDays > 0 ? ` (${p.noFlowDays} hari no flow)` : ''}`, x: M, y: top + ph + gap, decimals: 1 }, [{ name: 'Debit Inlet (L/S)', color: SERIES_BLUE, values: p.debit.inlet }, { name: 'Debit Outlet (L/S)', color: BLACK, values: p.debit.outlet }]);
  barChart({ ...base, title: 'Jenis & Qty Koagulan (kg)', x: M + pw + gap, y: top + ph + gap }, [{ name: 'Tawas Batu (kg)', color: NAVY, values: p.coag.batu }, { name: 'Tawas Serbuk (kg)', color: YELLOW, values: p.coag.serbuk }]);

  const x = W - M - rightW;
  let y = top;
  slide.addText('Summary Penggunaan Koagulan', { x, y, w: rightW, h: pt(16), bold: true, italic: true, fontSize: 9, fontFace: FONT, color: WHITE, fill: { color: NAVY }, valign: 'middle' });
  y += pt(16);
  y = summaryTable(slide, x, y, rightW, ['WEEKLY', ...p.weekly.labels], [
    ['Total Tawas (kg)', ...p.weekly.totalKg.map(n1)],
    ['Total (karung)', ...p.weekly.bags.map(n1)],
    ['Average per day (kg)', ...p.weekly.avgPerDay.map(n1)],
  ]) + pt(4);
  const chartH = pt(158);
  const side = { slide, pptx, x, w: rightW, h: chartH, panel: POND_PANEL, border: POND_BORDER, tag: NAVY, decimals: 0 };
  lineChart({ ...side, y, title: 'Penggunaan Koagulan MTD', categories: p.weekly.labels }, [{ name: 'Total Tawas (kg)', color: NAVY, values: p.weekly.chart }], { legend: false });
  y += chartH + pt(4);
  y = summaryTable(slide, x, y, rightW, ['MONTHLY', ...p.monthly.labels], [
    ['Total (kg)', ...p.monthly.totalKg.map(n1)],
    ['Total (karung)', ...p.monthly.bags.map(n1)],
  ]) + pt(4);
  lineChart({ ...side, y, title: 'Grafik Koagulan YTD', categories: p.ytdChart.labels }, [{ name: 'Total Tawas (kg)', color: NAVY, values: p.ytdChart.values }], { legend: false });
  y += chartH + pt(4);
  const bw = (rightW - pt(6)) / 2;
  totalsBox(slide, x, y, bw, 'Year To Date', p.ytd);
  totalsBox(slide, x + bw + pt(6), y, bw, 'Project To Date', p.project);
}

function eventSlides(pptx: Pptx, sec: ReportSection) {
  const slide = pptx.addSlide();
  slide.addText('EVENT', { x: M, y: M - 0.05, w: 3, h: 0.3, bold: true, fontSize: 13, fontFace: FONT, color: '000000' });
  const head: Row = sec.columns.map((c) => cell(c.header, { bold: true, color: WHITE, fill: { color: '0E7C66' }, fontSize: 8 }));
  const body: Row[] = sec.rows.map((r) => sec.columns.map((c) => cell(cellText(c, r.cells[c.key] ?? null), { fontSize: 8, color: '141414', border: { type: 'solid', color: 'CCCCCC', pt: 0.5 } })));
  slide.addTable([head, ...body], {
    x: M, y: M + pt(18), w: W - M * 2, autoPage: true, autoPageRepeatHeader: true, autoPageHeaderRows: 1,
    newSlideStartY: M, margin: [3, 3, 3, 3] as never, colW: Array(sec.columns.length).fill((W - M * 2) / sec.columns.length), valign: 'middle',
  });
}

/** Editable A4-landscape slide deck with the same pages as the PDF; charts and tables are native PowerPoint objects. pptxgenjs loads only when this runs. */
export async function buildSlidePptx(input: SlideInput): Promise<Blob> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'A4_LANDSCAPE', width: W, height: H });
  pptx.layout = 'A4_LANDSCAPE';
  pptx.title = 'Laporan ENVIRO';

  let started = false;
  if (input.weather) { weatherSlide(pptx, input.weather); started = true; }
  for (const p of input.ponds) { pondSlide(pptx, p); started = true; }
  if (input.event && input.event.rows.length > 0) { eventSlides(pptx, input.event); started = true; }
  if (!started) pptx.addSlide().addText(NO_DATA, { x: M, y: M, w: W - M * 2, h: 0.4, fontSize: 12, fontFace: FONT, color: '000000' });
  return (await pptx.write({ outputType: 'blob' })) as Blob;
}
