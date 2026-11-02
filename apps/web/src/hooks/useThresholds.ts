import { useEffect, useState } from 'react';
import type { Threshold } from '@evo/shared';
import { api } from '../api/client';

export function useThresholds() {
  const [t, setT] = useState<Record<string, Threshold>>({});
  useEffect(() => {
    api<Record<string, Threshold>>('/thresholds').then(setT).catch(() => {});
  }, []);
  return t;
}
