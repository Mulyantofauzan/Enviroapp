import { describe, it, expect } from 'vitest';
import { monitoringMessage, eventsMessage, limitMessage } from '../src/push/select';

describe('monitoringMessage', () => {
  it('is null when everything is filled', () => expect(monitoringMessage([], false)).toBeNull());
  it('lists ponds and weather', () => {
    const m = monitoringMessage(['SP 11 LGG'], true)!;
    expect(m.body).toBe('Belum diisi hari ini: SP 11 LGG (air), cuaca.');
    expect(m.url).toBe('/input');
  });
  it('weather only', () => expect(monitoringMessage([], true)!.body).toBe('Belum diisi hari ini: cuaca.'));
});

describe('eventsMessage', () => {
  it('is null with no titles', () => expect(eventsMessage('due', [])).toBeNull());
  it('one title', () => expect(eventsMessage('soon', ['Cek pompa'])!.body).toBe('Cek pompa.'));
  it('many titles are summarised', () => {
    const m = eventsMessage('overdue', ['A', 'B', 'C', 'D'])!;
    expect(m.body).toBe('4 event: A, B, dan 2 lainnya.');
    expect(m.url).toBe('/kalender');
  });
});

describe('limitMessage', () => {
  it('above max', () => expect(limitMessage('SP 11 LGG', 'tss_outlet', 52, { min: null, max: 40 }).body)
    .toBe('SP 11 LGG: TSS outlet 52 mg/L di atas baku mutu (maks. 40).'));
  it('below min', () => expect(limitMessage('SP 1', 'ph_outlet', 5.2, { min: 6, max: 9 }).body)
    .toBe('SP 1: pH outlet 5,2 di bawah baku mutu (min. 6).'));
  it('opens the dashboard', () => expect(limitMessage('SP 1', 'ph_outlet', 10, { min: 6, max: 9 }).url).toBe('/'));
});
