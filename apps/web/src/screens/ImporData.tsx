import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DailyInputRow } from '@evo/shared';
import { post } from '../api/client';
import { useToast } from '../components/Toast';
import { Icon } from '../icons';
import { saveBlob } from '../lib/download';
import { buildDailyTemplate, rowsToDaily } from '../lib/dailyImport';
import { readXlsx } from '../lib/xlsxRead';
import { dateText } from '../lib/dates';
import { Badge, type Tone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { DataTable, type Column } from '../ui/DataTable';
import { ScreenHeader } from '../ui/ScreenHeader';

type Status = 'create' | 'update' | 'unchanged' | 'error';
type Part = 'cuaca' | 'air' | 'koagulan';
type RowResult = { row: number; date: string; pond: string; status: Status; message?: string; parts: Part[] };
type Preview = { summary: { create: number; update: number; unchanged: number; error: number }; rows: RowResult[] };

const LABEL: Record<Status, string> = { create: 'Baru', update: 'Diperbarui', unchanged: 'Tidak berubah', error: 'Bermasalah' };
const TONE: Record<Status, Tone> = { create: 'success', update: 'water', unchanged: 'neutral', error: 'danger' };
const PART_LABEL: Record<Part, string> = { cuaca: 'Cuaca', air: 'Air', koagulan: 'Koagulan' };
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const readBytes = (file: File) => new Promise<Uint8Array>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
  r.onerror = () => reject(new Error('Berkas tidak bisa dibaca.'));
  r.readAsArrayBuffer(file);
});

const columns: Column<RowResult>[] = [
  { key: 'row', header: 'Baris', render: (r) => r.row },
  { key: 'date', header: 'Tanggal', render: (r) => (/^\d{4}-\d{2}-\d{2}$/.test(r.date) ? dateText(r.date) : r.date || '-') },
  { key: 'pond', header: 'Pond', render: (r) => r.pond || '-' },
  { key: 'parts', header: 'Bagian', render: (r) => r.parts.map((p) => PART_LABEL[p]).join(', ') || '-' },
  { key: 'status', header: 'Hasil', render: (r) => <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge> },
  { key: 'message', header: 'Keterangan', render: (r) => r.message ?? '' },
];

export function ImporData() {
  const nav = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<DailyInputRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    setPreview(null);
    setError('');
    if (!file) return;
    setBusy(true);
    try {
      const parsed = rowsToDaily(readXlsx(await readBytes(file)).sheets);
      setRows(parsed);
      setPreview(await post<Preview>('/entries/import', { rows: parsed, dry: true }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const done = await post<Preview>('/entries/import', { rows });
      toast(`Impor selesai: ${done.summary.create} baru, ${done.summary.update} diperbarui`);
      setPreview(null);
      setRows([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const s = preview?.summary;
  const changes = s ? s.create + s.update : 0;

  return (
    <>
      <ScreenHeader title="Impor Data Harian" subtitle="Cuaca, air, dan koagulan dari Excel" onProfile={() => nav('/akun')} />
      <div className="ui-page ui-page--mid">
        <Link to="/input" className="ui-back"><Icon name="chevron-left" /> Kembali ke Input</Link>
        <section className="ui-card ui-module">
          <h2>Berkas Excel</h2>
          <p className="ui-muted">Unduh templat, isi satu baris per tanggal dan pond, lalu pilih berkasnya. Hasilnya diperiksa dulu sebelum disimpan.</p>
          <Button variant="outline" onClick={() => saveBlob(new Blob([buildDailyTemplate().slice()], { type: XLSX_TYPE }), 'impor-data-harian-templat.xlsx')}>
            <Icon name="download" /> Unduh templat
          </Button>
          <label className="ui-text"><span>Berkas Excel</span>
            <input type="file" accept=".xlsx" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick(f); }} />
          </label>
        </section>

        {error && <p className="ui-error" role="alert">{error}</p>}
        {busy && !preview && <p className="ui-muted">Memeriksa berkas…</p>}

        {preview && s && (
          <section className="ui-card ui-module" aria-label="Pratinjau impor">
            <ul className="ui-legend" aria-label="Ringkasan">
              <li>Baru {s.create}</li><li>Diperbarui {s.update}</li><li>Tidak berubah {s.unchanged}</li><li>Bermasalah {s.error}</li>
            </ul>
            <DataTable caption="Hasil pemeriksaan per baris" columns={columns} rows={preview.rows} rowKey={(r) => String(r.row)} emptyText="Tidak ada baris." pageSize={500} />
            <Button block disabled={busy || changes === 0} onClick={confirm}>{busy ? 'Menyimpan…' : 'Impor'}</Button>
          </section>
        )}
      </div>
    </>
  );
}
