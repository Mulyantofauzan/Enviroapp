import { useRef, useState } from 'react';
import { COAGULANT_TYPES, formatNumber, type CoagulantType } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { saveEntry } from '../lib/outbox/save';
import { dayMonth } from '../lib/dates';
import { Icon } from '../icons';
import { useToast } from '../components/Toast';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { DayScope, type DayCtx } from './input/DayScope';
import { effectiveRemaining, hasInvalid, initialCoag, type CoagState } from './input/coag';

function KoagulanForm({ date, sp, data, canEdit, reload }: DayCtx) {
  const toast = useToast();
  const { user } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const [coag, setCoag] = useState(() => initialCoag(data));
  const [busy, setBusy] = useState(false);
  const patch = (t: CoagulantType, v: Partial<CoagState>) => setCoag((c) => ({ ...c, [t]: { ...c[t], ...v } }));

  async function save() {
    if (hasInvalid(root.current)) return toast('Perbaiki angka yang ditandai dulu.');
    setBusy(true);
    try {
      let queued = false;
      for (const t of COAGULANT_TYPES) {
        const v = coag[t];
        if (!data.coagulant[t] && v.stock_in === null && v.stock_out === null && v.stock_remaining === null) continue;
        const r = await saveEntry({
          owner: user!.id, kind: 'coagulant', key: `coagulant|${date}|${sp}|${t}`, label: `${t} ${dayMonth(date)}`,
          path: `/coagulant/${date}/${sp}/${encodeURIComponent(t)}`,
          body: { stock_in: v.stock_in, stock_out: v.stock_out, ...(v.stock_remaining !== null ? { stock_remaining: v.stock_remaining } : {}) },
        });
        queued = queued || r.queued;
      }
      if (queued) { toast('Tersimpan di HP, menunggu sinyal'); return; }
      toast('Data koagulan tersimpan');
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ui-stack" ref={root}>
      {COAGULANT_TYPES.map((t) => {
        const prev = data.previousRemaining[t];
        const remaining = effectiveRemaining(prev, coag[t]);
        return (
          <section key={t} className="ui-card ui-module" aria-label={t}>
            <h2>
              <span className="ui-bubble ui-bubble--warning"><Icon name="flask" /></span>
              <span>{t}<small>{prev === null ? 'Belum ada stok sebelumnya' : `Stok awal ${formatNumber(prev)} kg`}</small></span>
            </h2>
            <div className="ui-three">
              <NumberInput label="In" ariaLabel={`${t} masuk`} unit="kg" value={coag[t].stock_in} onChange={(v) => patch(t, { stock_in: v })} readOnly={!canEdit} />
              <NumberInput label="Out" ariaLabel={`${t} keluar`} unit="kg" value={coag[t].stock_out} onChange={(v) => patch(t, { stock_out: v })} readOnly={!canEdit} />
              <NumberInput label="Sisa" ariaLabel={`${t} sisa`} unit="kg" auto value={remaining} onChange={(v) => patch(t, { stock_remaining: v })} readOnly={!canEdit} />
            </div>
            {remaining < 0 && <p className="ui-error">Stok di bawah nol. Periksa hitungan Anda.</p>}
          </section>
        );
      })}
      {canEdit && <Button block disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan data koagulan'}</Button>}
    </div>
  );
}

export function InputKoagulan() {
  return <DayScope title="Penggunaan Koagulan">{(c) => <KoagulanForm {...c} />}</DayScope>;
}
