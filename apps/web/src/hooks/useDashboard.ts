import { useEffect, useState } from 'react';
import type { CoagulantType, Threshold } from '@evo/shared';
import { api } from '../api/client';

export type Dashboard = {
  date: string; days: number;
  today: { ph_outlet: number | null; tss_outlet: number | null; debit_outlet_m3s: number | null; debit_outlet_m3d: number | null; debit_outlet_ls: number | null; rainfall_mm: number | null; rain_hours: number | null } | null;
  series: { date: string; ph_inlet: number | null; ph_outlet: number | null; tss_inlet?: number | null; tss_outlet?: number | null; rainfall_mm?: number | null }[];
  coagulant: Record<CoagulantType, { remaining: number | null; max: number | null; updated: string | null }>;
  thresholds: Record<string, Threshold>;
};

export function useDashboard(sp: string | null, days: 7 | 30 | 90, date: string) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!sp) return;
    let live = true;
    setData(null);
    setError('');
    api<Dashboard>(`/dashboard?sp=${encodeURIComponent(sp)}&days=${days}&date=${date}`)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [sp, days, date]);
  return { data, error };
}
