import { formatNumber } from '@evo/shared';

export type Msg = { title: string; body: string; url: string; tag: string };

export function monitoringMessage(missingWater: string[], missingWeather: boolean): Msg | null {
  const parts = [...missingWater.map((n) => `${n} (air)`), ...(missingWeather ? ['cuaca'] : [])];
  if (parts.length === 0) return null;
  return { title: 'Pemantauan belum diisi', body: `Belum diisi hari ini: ${parts.join(', ')}.`, url: '/input', tag: 'monitoring' };
}

const EVENT_TITLE = { soon: 'Event kalender besok', due: 'Event kalender jatuh tempo hari ini', overdue: 'Event kalender hampir overdue' } as const;

export function eventsMessage(kind: keyof typeof EVENT_TITLE, titles: string[]): Msg | null {
  if (titles.length === 0) return null;
  const body = titles.length <= 2 ? titles.join(', ') + '.'
    : `${titles.length} event: ${titles[0]}, ${titles[1]}, dan ${titles.length - 2} lainnya.`;
  return { title: EVENT_TITLE[kind], body: titles.length === 1 ? `${titles[0]}.` : body, url: '/kalender', tag: `event-${kind}` };
}

export function limitMessage(pond: string, key: 'ph_outlet' | 'tss_outlet', value: number, t: { min: number | null; max: number | null }): Msg {
  const name = key === 'ph_outlet' ? 'pH outlet' : 'TSS outlet';
  const unit = key === 'tss_outlet' ? ' mg/L' : '';
  const below = t.min !== null && value < t.min;
  const rel = below ? `di bawah baku mutu (min. ${formatNumber(t.min)})` : `di atas baku mutu (maks. ${formatNumber(t.max)})`;
  return { title: 'Di luar baku mutu', body: `${pond}: ${name} ${formatNumber(value)}${unit} ${rel}.`, url: '/', tag: `limit-${key}` };
}
