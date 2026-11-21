import { formatNumber } from '@evo/shared';

type N = number | null;

export type WaWater = { ph_inlet: N; ph_outlet: N; tss_inlet: N; tss_outlet: N; debit_inlet_m3s: N; debit_outlet_m3s: N } | null;
export type WaWeather = { rainfall_mm: N } | null;

/** What the operator fills in on the share sheet. These are not stored; they only shape the message. */
export type WaExtras = {
  /** Where coagulant went, e.g. the pond code and a CB, with the sacks used at each. */
  places: { label: string; sack: string }[];
  batu: string;
  serbuk: string;
  remain: string;
  pintu: string;
  pompa: string;
};

export type WaInput = { title: string; date: string; time: string; weather: WaWeather; water: WaWater; extras: WaExtras };

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** "2026-11-09" -> "Senin 9 November 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** Current clock time in WITA as "10:30". */
export function witaTime(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const p = (t: string) => parts.find((x) => x.type === t)!.value;
  return `${p('hour')}:${p('minute')}`;
}

export function weatherText(w: WaWeather): string {
  if (!w || w.rainfall_mm === null) return '-';
  return w.rainfall_mm > 0 ? `Hujan (${formatNumber(w.rainfall_mm, 1)} mm)` : 'Cerah';
}

const num = (v: N, unit: string, noFlow: boolean, noFlowLabel: boolean) =>
  v !== null ? `${formatNumber(v, 2)}${unit ? ` ${unit}` : ''}` : noFlow && noFlowLabel ? '(No flow)' : '-';

/** A pond named "CB ..." is a CB; everything else is an SP. Decides which word the report uses. */
export const pondKind = (name: string): 'SP' | 'CB' => (/^\s*CB\b/i.test(name) ? 'CB' : 'SP');

export function buildWaReport({ title, date, time, weather, water, extras: x }: WaInput): string {
  const noFlow = water?.debit_outlet_m3s === 0;
  const ls = (m3s: N) => (m3s === null ? null : m3s * 1000);
  const dash = (s: string) => (s.trim() === '' ? '-' : s.trim());
  const sack = (s: string) => `${dash(s)} sack`;
  const outLs = ls(water?.debit_outlet_m3s ?? null);
  const lines = [
    '*Pengelolaan Kualitas Air*',
    `*${title}*`,
    `Periode : ${longDate(date)}`,
    `Jam : ${time} WITA`,
    `Cuaca : ${weatherText(weather)}`,
    '',
    `*Hasil Pemantauan ${pondKind(title)}*`,
    `• TSS Inlet : ${num(water?.tss_inlet ?? null, 'mg/L', noFlow, true)}`,
    `• TSS Outlet : ${num(water?.tss_outlet ?? null, 'mg/L', noFlow, true)}`,
    `• pH Inlet : ${num(water?.ph_inlet ?? null, '', noFlow, false)}`,
    `• pH Outlet : ${num(water?.ph_outlet ?? null, '', noFlow, false)}`,
    `• Debit Inlet : ${num(ls(water?.debit_inlet_m3s ?? null), 'L/s', noFlow, false)}`,
    `• Debit Outlet : ${outLs === 0 ? '(No flow)' : num(outLs, 'L/s', false, false)}`,
  ];
  if (x.pompa.trim()) lines.push('', `Pompa : ${x.pompa.trim()}`);
  lines.push('', '*Penggunaan Koagulan*', 'Jumlah :');
  for (const p of x.places) if (p.label.trim()) lines.push(`• ${p.label.trim()} : ${sack(p.sack)}`);
  lines.push('Jenis Koagulan :', `• Batu : ${sack(x.batu)}`, `• Serbuk : ${sack(x.serbuk)}`, `Remain : ${x.remain.trim() === '' ? '-' : `${x.remain.trim()} sack`}`);
  if (x.pintu.trim()) lines.push('', '*Pintu Air*', `• Pintu air : ${x.pintu.trim()}`);
  lines.push('', 'Demikian dilaporkan.');
  return lines.join('\n');
}

/** One sack of coagulant is 25 kg. */
export const SACK_KG = 25;
const sackOf = (kg: N) => (kg === null ? '' : formatNumber(kg / SACK_KG, 2));

/** Starting values for the message: sacks worked out from the kg the app records. Only Batu and Serbuk are in the template. */
export function defaultExtras(placeCode: string, c: { batuOutKg: N; serbukOutKg: N; remainKg: N }): WaExtras {
  const out = (c.batuOutKg ?? 0) + (c.serbukOutKg ?? 0);
  return {
    places: [{ label: placeCode, sack: sackOf(out) || '0' }, { label: '', sack: '0' }],
    batu: sackOf(c.batuOutKg ?? 0), serbuk: sackOf(c.serbukOutKg ?? 0), remain: sackOf(c.remainKg), pintu: 'Terbuka', pompa: '',
  };
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Hands the message to WhatsApp (the app on a phone) in this window, so the browser does not block it as a popup. */
export const openWhatsapp = (text: string) => { window.location.assign(whatsappUrl(text)); };
