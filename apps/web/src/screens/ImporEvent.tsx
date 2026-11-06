import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ImportInputRow } from '@evo/shared';
import { post } from '../api/client';
import { useToast } from '../components/Toast';
import { Icon } from '../icons';
import { saveBlob } from '../lib/download';
import { buildImportTemplate, rowsToImport } from '../lib/eventImport';
import { readXlsx } from '../lib/xlsxRead';
import { Badge, type Tone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { DataTable, type Column } from '../ui/DataTable';
import { ScreenHeader } from '../ui/ScreenHeader';

type Status = 'create' | 'update' | 'unchanged' | 'skipped' | 'error';
type RowResult = { row: number; title: string; category: string | null; status: Status; message?: string; newCategory?: boolean };
type Preview = { summary: { create: number; update: number; unchanged: number; skipped: number; error: number; newCategories: string[] }; rows: RowResult[] };

const LABEL: Record<Status, string> = { create: 'Baru', update: 'Diperbarui', unchanged: 'Tidak berubah', skipped: 'Dilewati', error: 'Bermasalah' };
const TONE: Record<Status, Tone> = { create: 'success', update: 'water', unchanged: 'neutral', skipped: 'warning', error: 'danger' };
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const readBytes = (file: File) => new Promise<Uint8Array>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
  r.onerror = () => reject(new Error('Berkas tidak bisa dibaca.'));
  r.readAsArrayBuffer(file);
});

const columns: Column<RowResult>[] = [
  { key: 'row', header: 'Baris', render: (r) => r.row },
  { key: 'title', header: 'Event', render: (r) => r.title },
  { key: 'category', header: 'Kategori', render: (r) => <>{r.category ?? '-'}{r.newCategory && <> <Badge tone="primary">Baru</Badge></>}</> },
  { key: 'status', header: 'Hasil', render: (r) => <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge> },
  { key: 'message', header: 'Keterangan', render: (r) => r.message ?? '' },
];

export function ImporEvent() {
  const nav = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<ImportInputRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    setPreview(null);
    setError('');
    if (!file) return;
    setBusy(true);
    try {
      const parsed = rowsToImport(readXlsx(await readBytes(file)).sheets);
      setRows(parsed);
      setPreview(await post<Preview>('/schedules/import', { rows: parsed, dry: true }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const done = await post<Preview>('/schedules/import', { rows });
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
      <ScreenHeader title="Impor Event" subtitle="Kalender Enviro Events" onProfile={() => nav('/akun')} />
      <div className="ui-page ui-page--mid">
        <Link to="/kalender/jadwal" className="ui-back"><Icon name="chevron-left" /> Kembali ke Atur Jadwal</Link>
        <section className="ui-card ui-module">
          <h2>Berkas Excel</h2>
          <p className="ui-muted">Unduh templat, isi satu baris per event, lalu pilih berkasnya. Hasilnya diperiksa dulu sebelum disimpan.</p>
          <Button variant="outline" onClick={() => saveBlob(new Blob([buildImportTemplate().slice()], { type: XLSX_TYPE }), 'impor-event-templat.xlsx')}>
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
              <li>Baru {s.create}</li><li>Diperbarui {s.update}</li><li>Tidak berubah {s.unchanged}</li><li>Dilewati {s.skipped}</li><li>Bermasalah {s.error}</li>
            </ul>
            {s.newCategories.length > 0 && <p>Kategori baru: {s.newCategories.join(', ')}</p>}
            <DataTable caption="Hasil pemeriksaan per baris" columns={columns} rows={preview.rows} rowKey={(r) => String(r.row)} emptyText="Tidak ada baris." pageSize={500} />
            <Button block disabled={busy || changes === 0} onClick={confirm}>{busy ? 'Menyimpan…' : 'Impor'}</Button>
          </section>
        )}
      </div>
    </>
  );
}
