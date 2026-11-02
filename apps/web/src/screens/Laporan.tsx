import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatNumber } from '@evo/shared';
import { useAuth } from '../auth/AuthContext';
import { ReportCharts } from '../components/ReportCharts';
import { useEventSummary } from '../hooks/useEventSummary';
import { useReportData } from '../hooks/useReportData';
import { Icon } from '../icons';
import { addDays, addMonths, dateText, monthRange } from '../lib/dates';
import { reportFilename, saveBlob } from '../lib/download';
import { buildReport, cellText, reportRowCount, type ReportKind, type ReportRow } from '../lib/report';
import { witaStamp } from '../lib/stamp';
import { validatePeriod } from '../lib/windows';
import { buildXlsx, type ReportMeta } from '../lib/xlsx';
import { usePond } from '../pond/PondContext';
import { Button } from '../ui/Button';
import { DataTable, type Column } from '../ui/DataTable';
import { pondLabel } from '../ui/PondPicker';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Segmented } from '../ui/Segmented';
import { localToday } from './input/DayScope';

type Preset = '7' | '30' | 'bulan' | 'lalu' | 'custom';
const PRESETS = [{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: 'bulan', label: 'Bulan ini' }, { value: 'lalu', label: 'Bulan lalu' }, { value: 'custom', label: 'Atur sendiri' }] as const;
const KINDS: { id: ReportKind; label: string }[] = [{ id: 'cuaca', label: 'Cuaca' }, { id: 'air', label: 'Air Permukaan' }, { id: 'koagulan', label: 'Koagulan' }, { id: 'event', label: 'Event' }];
const PREVIEW_ROWS = 50;
const MAX_ROWS = 20_000;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Row = ReportRow & { i: number };

export function Laporan() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { ponds, current, loading: pondsLoading } = usePond();
  const { summary, error: summaryError } = useEventSummary();
  const today = summary?.today ?? (summaryError ? localToday() : null);

  const [preset, setPreset] = useState<Preset>('7');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [spChoice, setSpChoice] = useState<string | null>(null);
  const [active, setActive] = useState<Set<ReportKind>>(new Set(['cuaca', 'air', 'koagulan']));
  const [view, setView] = useState<ReportKind>('air');
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState('');

  const sp = spChoice ?? current ?? '';
  const pond = ponds.find((p) => p.id === sp);

  const [from, to] = useMemo<[string, string]>(() => {
    if (!today) return ['', ''];
    if (preset === 'custom' && custom) return [custom.from, custom.to];
    if (preset === '30') return [addDays(today, -29), today];
    if (preset === 'bulan') return [`${today.slice(0, 7)}-01`, today];
    if (preset === 'lalu') return monthRange(addMonths(today.slice(0, 7), -1));
    return [addDays(today, -6), today];
  }, [today, preset, custom]);

  const periodError = today ? validatePeriod(from, to) : null;
  const kinds = KINDS.filter((k) => active.has(k.id)).map((k) => k.id);
  const data = useReportData({ from, to, sp, kinds, today: today && !pondsLoading && !periodError ? today : null });
  const sections = useMemo(
    () => buildReport({ entries: data.entries ?? [], events: data.events ?? [], ponds, kinds }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.entries, data.events, ponds, kinds.join()],
  );
  const total = reportRowCount(sections);
  const shownView = kinds.includes(view) ? view : kinds[0];
  const section = sections.find((s) => s.id === shownView);

  function choosePreset(p: Preset) {
    if (p === 'custom') setCustom({ from, to });
    setPreset(p);
  }
  function toggle(k: ReportKind) {
    const next = new Set(active);
    if (next.has(k)) { if (next.size === 1) return; next.delete(k); } else next.add(k);
    setActive(next);
  }

  const lokasi = pond ? pondLabel(pond) : 'Semua lokasi';
  const meta = (): ReportMeta => ({
    title: 'Laporan EVO', lokasi, periode: `${dateText(from)} - ${dateText(to)}`,
    dibuatOleh: user?.name ?? '-', dibuatPada: `${witaStamp(new Date())} WITA`,
  });

  async function exportExcel() {
    setExportError('');
    if (total > MAX_ROWS) { setExportError(`Ada ${formatNumber(total, 0)} baris. Persempit periode agar tidak lebih dari 20.000.`); return; }
    setBusy(true);
    try {
      const bytes = buildXlsx(meta(), sections);
      saveBlob(new Blob([bytes.slice()], { type: XLSX_TYPE }), reportFilename(lokasi, from, to, 'xlsx'));
    } catch (e) {
      setExportError((e as Error).message || 'Berkas tidak bisa dibuat. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Row>[] = (section?.columns ?? []).map((c, idx) => ({
    key: c.key, header: c.header, sticky: idx === 0, align: c.kind === 'number' ? 'right' : 'left',
    render: (r) => cellText(c, r.cells[c.key] ?? null),
    cellClass: (r) => (r.bad.includes(c.key) ? 'is-bad' : ''),
  }));
  const previewRows: Row[] = (section?.rows ?? []).slice(0, PREVIEW_ROWS).map((r, i) => ({ ...r, i }));
  const error = periodError || data.error;
  const canExport = !data.loading && !error && total > 0 && !busy;

  return (
    <>
      <ScreenHeader title="Laporan" subtitle="Tarik data dan unduh untuk presentasi" onProfile={() => nav('/akun')} />
      <div className="ui-page ui-page--wide">
        <section className="ui-card ui-filters" aria-label="Filter laporan">
          <label className="ui-filters__wide"><span>Lokasi</span>
            <select aria-label="Lokasi" value={sp} onChange={(e) => setSpChoice(e.target.value)}>
              <option value="">Semua lokasi</option>
              {ponds.map((p) => <option key={p.id} value={p.id}>{pondLabel(p)}</option>)}
            </select>
          </label>
          <div className="ui-filters__wide">
            <Segmented label="Periode" options={[...PRESETS]} value={preset} onChange={choosePreset} />
          </div>
          {preset === 'custom' && (
            <>
              <label><span>Dari</span><input type="date" value={from} onChange={(e) => e.target.value && setCustom({ from: e.target.value, to })} /></label>
              <label><span>Sampai</span><input type="date" value={to} onChange={(e) => e.target.value && setCustom({ from, to: e.target.value })} /></label>
            </>
          )}
          <div className="ui-filters__wide">
            <span className="ui-pick__label">Data yang disertakan</span>
            <div className="ui-chips">
              {KINDS.map((k) => (
                <button key={k.id} type="button" aria-pressed={active.has(k.id)} className={active.has(k.id) ? 'is-on' : ''} onClick={() => toggle(k.id)}>{k.label}</button>
              ))}
            </div>
            {sp && active.has('cuaca') && <p className="ui-report-note">Cuaca berlaku untuk seluruh lokasi.</p>}
          </div>
        </section>

        {error && <p className="ui-error" role="alert">{error}</p>}
        {data.loading && <p className="ui-muted">{data.progress || 'Memuat data…'}</p>}
        {!data.loading && !error && total === 0 && <p className="ui-muted">Tidak ada data pada periode ini.</p>}

        {section && total > 0 && (
          <section className="ui-card" aria-label="Pratinjau">
            <Segmented label="Pratinjau" options={kinds.map((k) => ({ value: k, label: KINDS.find((x) => x.id === k)!.label }))} value={shownView} onChange={setView} />
            <DataTable caption={section.title} columns={columns} rows={previewRows} rowKey={(r) => String(r.i)} emptyText="Tidak ada data pada periode ini." pageSize={PREVIEW_ROWS} />
            <p className="ui-report-note">Pratinjau {previewRows.length} dari {section.rows.length} baris</p>
            <p className="ui-report-note">Debit harian dihitung otomatis dari m³/s. Sel merah menandai nilai di luar baku mutu.</p>
          </section>
        )}

        {today && !periodError && (
          <ReportCharts kinds={kinds} entries={data.entries} ytd={data.ytd} spId={sp} thresholds={pond?.thresholds} from={from} to={to} today={today} />
        )}

        {exportError && <p className="ui-error" role="alert">{exportError}</p>}
        <Button disabled={!canExport} onClick={exportExcel}><Icon name="download" /> {busy ? 'Menyiapkan…' : 'Ekspor Excel (.xlsx)'}</Button>
      </div>
    </>
  );
}
