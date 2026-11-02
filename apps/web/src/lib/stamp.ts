/** "-3.78421, 115.60214": five decimals, a dot, never a negative zero (matches the design). */
export function formatCoords(lat: number, lng: number): string {
  const f = (n: number) => { const s = n.toFixed(5); return s === '-0.00000' ? '0.00000' : s; };
  return `${f(lat)}, ${f(lng)}`;
}

const WITA = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** "2 Nov 2026 08:21" in the site's time zone. */
export function witaStamp(at: Date): string {
  const p = Object.fromEntries(WITA.formatToParts(at).map((x) => [x.type, x.value]));
  return `${p.day} ${String(p.month).replace('.', '')} ${p.year} ${p.hour}:${p.minute}`;
}

export function stampText(pos: { lat: number; lng: number } | null, at: Date): string {
  const when = `${witaStamp(at)} WITA`;
  return pos ? `GPS ${formatCoords(pos.lat, pos.lng)} - ${when}` : `Tanpa lokasi - ${when}`;
}
