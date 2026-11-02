import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { Threshold } from '@evo/shared';

export type Pond = {
  id: string; code: string | null; name: string; latitude?: number | null; longitude?: number | null;
  is_active: boolean; thresholds?: Record<string, Threshold>;
};
type Ctx = { ponds: Pond[]; current: string | null; setCurrent: (id: string) => void; loading: boolean; error: string; reload: () => void };

const KEY = 'evo.sp';
const PondCtx = createContext<Ctx | null>(null);

const readStored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const writeStored = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* storage is optional */ } };

export function PondProvider({ children }: { children: ReactNode }) {
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [stored, setStored] = useState<string | null>(readStored);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    api<Pond[]>('/ponds').then((p) => { setPonds(p); setError(''); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [tick]);

  const current = ponds.find((p) => p.id === stored)?.id ?? ponds[0]?.id ?? null;
  const setCurrent = useCallback((id: string) => { setStored(id); writeStored(id); }, []);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return <PondCtx.Provider value={{ ponds, current, setCurrent, loading, error, reload }}>{children}</PondCtx.Provider>;
}

export function usePond(): Ctx {
  const c = useContext(PondCtx);
  if (!c) throw new Error('usePond outside PondProvider');
  return c;
}
