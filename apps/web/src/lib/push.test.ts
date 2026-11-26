import { describe, it, expect, afterEach } from 'vitest';
import { pushSupport } from './push';

const ua = (s: string) => Object.defineProperty(navigator, 'userAgent', { value: s, configurable: true });
afterEach(() => { delete (navigator as any).standalone; });

describe('pushSupport', () => {
  it('is unsupported without service worker / PushManager', () => expect(pushSupport()).toBe('unsupported'));
  it('asks an iPhone browser tab to install the app first', () => {
    ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(pushSupport()).toBe('needs-install');
    ua('Mozilla/5.0');
  });
});
