import { FREQUENCY_LABEL, formatNumber, isNoFlow, isOutOfLimit, type EventOccurrence } from '@evo/shared';
import type { Pond } from '../pond/PondContext';
import { pondLabel } from '../ui/PondPicker';
import { dateText } from './dates';
import { witaStamp } from './stamp';

export type HistoryEntry = {
  date: string;
  sp_id: string | null;
  weather: { rainfall_mm: number | null; rain_hours: number | null } | null;
  water: {
    ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null;
    debit_inlet_m3d: number | null; debit_outlet_m3d: number | null;
    debit_inlet_ls?: number | null; debit_outlet_ls?: number | null;
  } | null;
  coagulant: { type: string; stock_in: number | null; stock_out: number | null; stock_remaining: number | null; staleRemaining: boolean }[];
};

export type ReportKind = 'cuaca' | 'air' | 'koagulan' | 'event';
export type Cell = string | number | null;
export type ReportColumn = { key: string; header: string; kind: 'text' | 'number'; decimals?: number };
export type ReportRow = { cells: Record<string, Cell>; bad: string[] };
export type ReportSection = { id: ReportKind; title: string; columns: ReportColumn[]; rows: ReportRow[]; note?: string };

/** A day with no water leaving the pond: outlet flow recorded as 0. */
export const entryNoFlow = (w: NonNullable<HistoryEntry['water']>): boolean => isNoFlow(w.debit_outlet_ls ?? w.debit_outlet_m3d ?? null);
export const NO_FLOW = 'No flow';

const text = (key: string, header: string): ReportColumn => ({ key, header, kind: 'text' });
const num = (key: string, header: string, decimals = 3): ReportColumn => ({ key, header, kind: 'number', decimals });
const byDateDesc = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

const STATUS = { overdue: 'Overdue', today: 'Hari ini', upcoming: 'Mendatang' } as const;
const statusText = (e: EventOccurrence) => (e.status === 'done' ? (e.late ? 'Selesai (terlambat)' : 'Selesai') : STATUS[e.status]);

export function buildReport(input: { entries: HistoryEntry[]; events: EventOccurrence[]; ponds: Pond[]; kinds: ReportKind[] }): ReportSection[] {
  const { entries, events, ponds, kinds } = input;
  const byId = new Map(ponds.map((p) => [p.id, p]));
  const pondShort = (id: string | null) => { const p = id ? byId.get(id) : undefined; return p ? p.code ?? p.name : id ? 'Pond' : null; };
  const sorted = [...entries].sort(byDateDesc);
  const out: ReportSection[] = [];

  if (kinds.includes('cuaca')) {
    const seen = new Set<string>();
    const rows: ReportRow[] = [];
    for (const e of sorted) {
      if (!e.weather || seen.has(e.date)) continue;
      seen.add(e.date);
      rows.push({ cells: { date: dateText(e.date), rain: e.weather.rainfall_mm, hours: e.weather.rain_hours }, bad: [] });
    }
    out.push({ id: 'cuaca', title: 'Cuaca', columns: [text('date', 'Tanggal'), num('rain', 'Rainfall (mm)'), num('hours', 'Rain hours (jam)')], rows });
  }

  if (kinds.includes('air')) {
    const rows: ReportRow[] = [];
    let noFlowDays = 0;
    for (const e of sorted) {
      const w = e.water;
      if (!w) continue;
      const th = e.sp_id ? byId.get(e.sp_id)?.thresholds : undefined;
      const nf = entryNoFlow(w);
      if (nf) noFlowDays += 1;
      const bad: string[] = [];
      if (!nf && isOutOfLimit(w.ph_outlet, th?.ph_outlet)) bad.push('pho');
      if (!nf && isOutOfLimit(w.tss_outlet, th?.tss_outlet)) bad.push('tsso');
      rows.push({
        cells: {
          date: dateText(e.date), pond: pondShort(e.sp_id), phi: w.ph_inlet, pho: nf ? NO_FLOW : w.ph_outlet, tssi: w.tss_inlet, tsso: nf ? NO_FLOW : w.tss_outlet,
          di: w.debit_inlet_ls ?? null, do: nf ? NO_FLOW : w.debit_outlet_ls ?? null,
        },
        bad,
      });
    }
    out.push({
      id: 'air', title: 'Air Permukaan',
      columns: [text('date', 'Tanggal'), text('pond', 'Pond'), num('phi', 'pH inlet'), num('pho', 'pH outlet'), num('tssi', 'TSS inlet (mg/L)'), num('tsso', 'TSS outlet (mg/L)'), num('di', 'Debit inlet (L/s)', 1), num('do', 'Debit outlet (L/s)', 1)],
      rows,
      ...(noFlowDays > 0 ? { note: `${noFlowDays} hari no flow dalam periode ini.` } : {}),
    });
  }

  if (kinds.includes('koagulan')) {
    const rows: ReportRow[] = sorted.flatMap((e) => e.coagulant.map((c) => ({
      cells: { date: dateText(e.date), pond: pondShort(e.sp_id), type: c.type, in: c.stock_in, out: c.stock_out, left: c.stock_remaining, note: c.staleRemaining ? 'Selisih stok' : null },
      bad: [],
    })));
    out.push({
      id: 'koagulan', title: 'Koagulan',
      columns: [text('date', 'Tanggal'), text('pond', 'Pond'), text('type', 'Jenis'), num('in', 'Masuk (kg)'), num('out', 'Keluar (kg)'), num('left', 'Sisa (kg)'), text('note', 'Catatan')],
      rows,
    });
  }

  if (kinds.includes('event')) {
    const rows: ReportRow[] = [...events].sort((a, b) => (a.due_date < b.due_date ? 1 : a.due_date > b.due_date ? -1 : 0)).map((e) => {
      return {
        cells: {
          due: dateText(e.due_date), title: e.title, freq: FREQUENCY_LABEL[e.frequency], category: e.category_name ?? 'Tanpa kategori', status: statusText(e),
          by: e.completed_by_name, at: e.completed_at ? witaStamp(new Date(e.completed_at)) : null, evidence: e.evidence_count,
        },
        bad: [],
      };
    });
    out.push({
      id: 'event', title: 'Event',
      columns: [text('due', 'Tenggat'), text('title', 'Judul'), text('freq', 'Frekuensi'), text('category', 'Kategori'), text('status', 'Status'), text('by', 'Diselesaikan oleh'), text('at', 'Waktu selesai (WITA)'), num('evidence', 'Jumlah eviden', 0)],
      rows,
    });
  }
  return out;
}

export function cellText(col: ReportColumn, v: Cell): string {
  if (v === null || v === '') return '–';
  return typeof v === 'number' ? formatNumber(v, col.decimals ?? 3) : v;
}

export const reportRowCount = (sections: ReportSection[]): number => sections.reduce((n, s) => n + s.rows.length, 0);
