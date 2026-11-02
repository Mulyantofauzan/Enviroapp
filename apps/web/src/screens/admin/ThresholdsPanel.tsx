import { useEffect, useState } from 'react';
import { THRESHOLD_KEYS, type Threshold } from '@evo/shared';
import { api, put } from '../../api/client';
import { useToast } from '../../components/Toast';
import { NumberField } from '../../components/NumberField';

const LABELS: Record<string, string> = { ph_inlet: 'pH inlet', ph_outlet: 'pH outlet', tss_inlet: 'TSS inlet', tss_outlet: 'TSS outlet' };

export function ThresholdsPanel() {
  const toast = useToast();
  const [t, setT] = useState<Record<string, Threshold>>({});
  useEffect(() => { api<Record<string, Threshold>>('/thresholds').then(setT).catch((e) => toast(e.message)); }, []); // eslint-disable-line

  async function save(key: string) {
    const cur = t[key] ?? { min: null, max: null };
    try { await put(`/thresholds/${key}`, cur); toast('Limit saved'); } catch (err) { toast((err as Error).message); }
  }

  return (
    <div className="stack">
      <p className="muted">Leave a box empty for no limit on that side. Values outside the limits turn pink on entry; saving is never blocked.</p>
      {THRESHOLD_KEYS.map((k) => {
        const cur = t[k] ?? { min: null, max: null };
        return (
          <div key={k} className="row-card">
            <strong>{LABELS[k]}</strong>
            <NumberField label={`${LABELS[k]} min`} value={cur.min} onChange={(v) => setT({ ...t, [k]: { ...cur, min: v } })} />
            <NumberField label={`${LABELS[k]} max`} value={cur.max} onChange={(v) => setT({ ...t, [k]: { ...cur, max: v } })} />
            <button className="btn-secondary" onClick={() => save(k)}>Save limit</button>
          </div>
        );
      })}
    </div>
  );
}
