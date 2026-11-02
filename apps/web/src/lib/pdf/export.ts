import { api } from '../../api/client';
import type { Pond } from '../../pond/PondContext';
import { addDays } from '../dates';
import type { HistoryEntry, ReportKind, ReportSection } from '../report';
import { pondPage, weatherPage } from './pages';
import { buildSlidePdf, type SlideInput } from './slides';

type Totals = { ponds: { sp_id: string; 'Tawas Serbuk': number; 'Tawas Batu': number }[] };

const byCodeThenName = (a: Pond, b: Pond) => (a.code ?? '').localeCompare(b.code ?? '') || a.name.localeCompare(b.name);

/** Fetches what the slides need (a year of history, lifetime tawas totals) and builds the PDF. Reads nothing from the page. */
export async function buildPdfReport(o: {
  to: string; sp: string; kinds: ReportKind[]; ponds: Pond[]; eventSection: ReportSection | null;
  fetchJson?: typeof api; build?: typeof buildSlidePdf;
}): Promise<Blob> {
  const fetchJson = o.fetchJson ?? api;
  const build = o.build ?? buildSlidePdf;
  const spQ = o.sp ? `&sp=${encodeURIComponent(o.sp)}` : '';
  const wantsPonds = o.kinds.includes('air') || o.kinds.includes('koagulan');

  const [entries, totals] = await Promise.all([
    fetchJson<HistoryEntry[]>(`/history?from=${addDays(o.to, -365)}&to=${o.to}${spQ}`),
    wantsPonds ? fetchJson<Totals>(`/history/coagulant-total?to=${o.to}${spQ}`) : Promise.resolve(null),
  ]);

  const input: SlideInput = { weather: null, ponds: [], event: null };
  if (o.kinds.includes('cuaca')) input.weather = weatherPage(entries, o.to);
  if (wantsPonds) {
    const hasData = (id: string) => entries.some((e) => e.sp_id === id && (e.water || e.coagulant.length > 0));
    const chosen = o.sp ? o.ponds.filter((p) => p.id === o.sp) : o.ponds.filter((p) => p.is_active && hasData(p.id));
    input.ponds = [...chosen].sort(byCodeThenName).map((p) => {
      const t = totals?.ponds.find((x) => x.sp_id === p.id);
      return pondPage(entries, p, o.to, t ? { serbuk: t['Tawas Serbuk'], batu: t['Tawas Batu'] } : null);
    });
  }
  if (o.kinds.includes('event') && o.eventSection && o.eventSection.rows.length > 0) input.event = o.eventSection;
  return build(input);
}
