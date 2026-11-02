import { useEffect, useState } from 'react';

export type GeoState = {
  status: 'locating' | 'ready' | 'denied' | 'unavailable';
  position: { lat: number; lng: number; accuracy: number } | null;
};

/** Watches the device position while `active`. A short failure after a good fix keeps the last fix. */
export function useGeolocation(active: boolean): GeoState {
  const [state, setState] = useState<GeoState>({ status: 'locating', position: null });
  useEffect(() => {
    if (!active) return;
    const geo = navigator.geolocation;
    if (!geo) { setState({ status: 'unavailable', position: null }); return; }
    setState({ status: 'locating', position: null });
    const id = geo.watchPosition(
      (p) => setState({ status: 'ready', position: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (e) => setState((s) => (e.code === 1 ? { status: 'denied', position: null } : s.position ? s : { status: 'unavailable', position: null })),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => geo.clearWatch(id);
  }, [active]);
  return state;
}
