import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

type Ok = (p: { coords: { latitude: number; longitude: number; accuracy: number } }) => void;
type Err = (e: { code: number }) => void;

function fakeGeo() {
  const g = { ok: null as Ok | null, err: null as Err | null, watch: vi.fn(), clear: vi.fn() };
  g.watch.mockImplementation((ok: Ok, err: Err) => { g.ok = ok; g.err = err; return 7; });
  Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: g.watch, clearWatch: g.clear }, configurable: true });
  return g;
}
afterEach(() => { Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true }); });

describe('useGeolocation', () => {
  it('does nothing while inactive', () => {
    const g = fakeGeo();
    renderHook(() => useGeolocation(false));
    expect(g.watch).not.toHaveBeenCalled();
  });
  it('starts locating, then reports the position with accuracy', () => {
    const g = fakeGeo();
    const { result } = renderHook(() => useGeolocation(true));
    expect(result.current).toEqual({ status: 'locating', position: null });
    expect(g.watch).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), expect.objectContaining({ enableHighAccuracy: true }));
    act(() => g.ok!({ coords: { latitude: -3.78421, longitude: 115.60214, accuracy: 9 } }));
    expect(result.current).toEqual({ status: 'ready', position: { lat: -3.78421, lng: 115.60214, accuracy: 9 } });
  });
  it('permission refused is "denied"', () => {
    const g = fakeGeo();
    const { result } = renderHook(() => useGeolocation(true));
    act(() => g.err!({ code: 1 }));
    expect(result.current).toEqual({ status: 'denied', position: null });
  });
  it('any other failure with no fix yet is "unavailable"', () => {
    const g = fakeGeo();
    const { result } = renderHook(() => useGeolocation(true));
    act(() => g.err!({ code: 2 }));
    expect(result.current.status).toBe('unavailable');
  });
  it('a brief failure after a good fix keeps the last position', () => {
    const g = fakeGeo();
    const { result } = renderHook(() => useGeolocation(true));
    act(() => g.ok!({ coords: { latitude: 1, longitude: 2, accuracy: 5 } }));
    act(() => g.err!({ code: 3 }));
    expect(result.current).toEqual({ status: 'ready', position: { lat: 1, lng: 2, accuracy: 5 } });
  });
  it('a browser with no geolocation at all is "unavailable"', () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
    const { result } = renderHook(() => useGeolocation(true));
    expect(result.current.status).toBe('unavailable');
  });
  it('stops watching when turned off and when removed', () => {
    const g = fakeGeo();
    const { rerender, unmount } = renderHook(({ on }) => useGeolocation(on), { initialProps: { on: true } });
    rerender({ on: false });
    expect(g.clear).toHaveBeenCalledWith(7);
    rerender({ on: true });
    unmount();
    expect(g.clear).toHaveBeenCalledTimes(2);
  });
});
