import { useRef, useState } from 'react';
import { put } from '../api/client';
import { Icon } from '../icons';
import { useToast } from '../components/Toast';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { DayScope, type DayCtx } from './input/DayScope';
import { hasInvalid } from './input/coag';

function CuacaForm({ date, data, canEdit, reload }: DayCtx) {
  const toast = useToast();
  const root = useRef<HTMLDivElement>(null);
  const [rain, setRain] = useState<number | null>(data.weather?.rainfall_mm ?? null);
  const [hours, setHours] = useState<number | null>(data.weather?.rain_hours ?? null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (hasInvalid(root.current)) return toast('Perbaiki angka yang ditandai dulu.');
    setBusy(true);
    try {
      await put(`/weather/${date}`, { rainfall_mm: rain, rain_hours: hours });
      toast('Data cuaca tersimpan');
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ui-stack" ref={root}>
      <section className="ui-card ui-module">
        <h2><span className="ui-bubble ui-bubble--water"><Icon name="cloud-rain" /></span> Curah hujan</h2>
        <div className="ui-two">
          <NumberInput label="Rainfall" unit="mm" value={rain} onChange={setRain} readOnly={!canEdit} />
          <NumberInput label="Rain hours" unit="jam" value={hours} onChange={setHours} readOnly={!canEdit} />
        </div>
      </section>
      <Banner tone="info" title="Data langsung masuk laporan">Dapat diedit kapan saja tanpa approval</Banner>
      {canEdit && <Button block disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan data cuaca'}</Button>}
    </div>
  );
}

export function InputCuaca() {
  return <DayScope title="Pencatatan Cuaca">{(c) => <CuacaForm {...c} />}</DayScope>;
}
