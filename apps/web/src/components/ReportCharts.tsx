import { formatNumber, type Threshold } from '@evo/shared';
import { meanByMonth, meanByWeek, sumByMonth, sumByWeek, type Bucket } from '../lib/aggregate';
import { addDays } from '../lib/dates';
import type { HistoryEntry, ReportKind } from '../lib/report';
import { coagUsageBuckets, fillDates, rainByDate, tawasByDate, waterByDate } from '../lib/reportSeries';
import { BarChart } from './BarChart';
import { PhChart } from './PhChart';
import { TrendChart } from './TrendChart';

type Props = {
  kinds: ReportKind[];
  entries: HistoryEntry[] | null;
  ytd: HistoryEntry[] | null;
  ytdError?: string;
  spId: string;
  thresholds: Record<string, Threshold> | undefined;
  from: string;
  to: string;
  today: string;
};

function stats(values: (number | null)[], unit: string, decimals = 1, runningLast = false): string | null {
  const v = values.filter((x): x is number => x !== null);
  if (v.length === 0) return null;
  const f = (n: number) => `${formatNumber(n, decimals)} ${unit}`.trim();
  return `Tertinggi ${f(Math.max(...v))}, terendah ${f(Math.min(...v))}, terakhir ${f(v[v.length - 1])}.${runningLast ? ' Periode terakhir masih berjalan.' : ''}`;
}

function Card({ kind, title, note, children }: { kind: ReportKind; title: string; note?: string | null; children: React.ReactNode }) {
  return (
    <section className="ui-card" data-report-chart-card data-section={kind}>
      <h2>{title}</h2>
      {children}
      {note && <p className="ui-muted ui-chart__note">{note}</p>}
    </section>
  );
}

const cats = (b: Bucket[]) => b.map((x) => ({ key: x.key, label: x.label, partial: x.partial }));

/** The nine report charts, shown for the chips that are on. Each card keeps its svg so the PDF can reuse it. */
export function ReportCharts({ kinds, entries, ytd, ytdError = '', spId, thresholds, from, to, today }: Props) {
  const longCard = (kind: ReportKind, title: string) => (
    <Card kind={kind} key={title} title={title}>{ytdError ? <p className="ui-error">Grafik jangka panjang tidak bisa dimuat: {ytdError}</p> : <p className="ui-muted">Memuat…</p>}</Card>
  );
  const loadingCard = (kind: ReportKind, title: string) => <Card kind={kind} key={title} title={title}><p className="ui-muted">Memuat…</p></Card>;
  const cards: React.ReactNode[] = [];

  if (kinds.includes('cuaca')) {
    const t1 = 'Curah hujan, 7 hari terakhir';
    const t2 = 'Rata-rata curah hujan per minggu, 5 minggu terakhir';
    const t3 = 'Rata-rata curah hujan per bulan, 12 bulan terakhir';
    if (!ytd) cards.push(longCard('cuaca', t1), longCard('cuaca', t2), longCard('cuaca', t3));
    else {
      const rain = rainByDate(ytd);
      const map = new Map(rain.map((d) => [d.date, d.value]));
      const week = fillDates(addDays(today, -6), today).map((date) => ({ date, inlet: null, outlet: map.get(date) ?? null }));
      const wk = meanByWeek(rain, today);
      const mo = meanByMonth(rain, today);
      cards.push(
        <Card kind="cuaca" key={t1} title={t1} note={stats(week.map((w) => w.outlet), 'mm')}>
          {week.some((w) => w.outlet !== null)
            ? <TrendChart name="Curah hujan" unit="mm" series={week} limit={undefined} hide="inlet" outletLabel="Curah hujan (mm)" floorZero decimals={1} />
            : <p className="ui-muted">Belum ada data pada rentang ini.</p>}
        </Card>,
        <Card kind="cuaca" key={t2} title={t2} note={stats(wk.map((b) => b.value), 'mm/hari', 1, wk[wk.length - 1].partial)}>
          <BarChart name="Rata-rata curah hujan per minggu" unit="mm/hari" categories={cats(wk)} series={[{ name: 'Rata-rata (mm/hari)', values: wk.map((b) => b.value) }]} />
        </Card>,
        <Card kind="cuaca" key={t3} title={t3} note={stats(mo.map((b) => b.value), 'mm/hari', 1, mo[mo.length - 1].partial)}>
          <BarChart name="Rata-rata curah hujan per bulan" unit="mm/hari" categories={cats(mo)} series={[{ name: 'Rata-rata (mm/hari)', values: mo.map((b) => b.value) }]} />
        </Card>,
      );
    }
  }

  if (kinds.includes('air')) {
    const titles = ['pH harian', 'TSS inlet dan outlet harian', 'Debit outlet harian'];
    if (!spId) {
      for (const t of titles) cards.push(<Card kind="air" key={t} title={t}><p className="ui-muted">Pilih satu lokasi untuk melihat grafik air permukaan.</p></Card>);
    } else if (!entries) {
      for (const t of titles) cards.push(loadingCard('air', t));
    } else {
      const w = waterByDate(entries, spId, from, to);
      const has = (k: 'ph_outlet' | 'ph_inlet' | 'tss_outlet' | 'tss_inlet' | 'debit_outlet_ls') => w.some((d) => d[k] !== null);
      const empty = <p className="ui-muted">Belum ada data pada rentang ini.</p>;
      cards.push(
        <Card kind="air" key={titles[0]} title={titles[0]} note={stats(w.map((d) => d.ph_outlet), 'pH outlet', 2)}>
          {has('ph_outlet') || has('ph_inlet') ? <PhChart series={w} band={thresholds?.ph_outlet} /> : empty}
        </Card>,
        <Card kind="air" key={titles[1]} title={titles[1]} note={stats(w.map((d) => d.tss_outlet), 'mg/L outlet')}>
          {has('tss_outlet') || has('tss_inlet') ? <TrendChart name="TSS" unit="mg/L" floorZero limit={thresholds?.tss_outlet} decimals={1} series={w.map((d) => ({ date: d.date, inlet: d.tss_inlet, outlet: d.tss_outlet }))} /> : empty}
        </Card>,
        <Card kind="air" key={titles[2]} title={titles[2]} note={stats(w.map((d) => d.debit_outlet_ls), 'L/s')}>
          {has('debit_outlet_ls') ? <TrendChart name="Debit outlet" unit="L/s" floorZero limit={undefined} hide="inlet" outletLabel="Debit outlet (L/s)" decimals={1} series={w.map((d) => ({ date: d.date, inlet: null, outlet: d.debit_outlet_ls }))} /> : empty}
        </Card>,
      );
    }
  }

  if (kinds.includes('koagulan')) {
    const dailyTitle = (u: string) => `Penggunaan koagulan per jenis, ${u === 'hari' ? 'harian' : u === 'minggu' ? 'mingguan' : 'bulanan'}`;
    const t2 = 'Penggunaan tawas per minggu, 5 minggu terakhir';
    const t3 = 'Penggunaan tawas per bulan, 12 bulan terakhir';
    if (!entries) cards.push(loadingCard('koagulan', 'Penggunaan koagulan per jenis')); else {
      const usage = coagUsageBuckets(entries, from, to);
      const t1 = dailyTitle(usage.unit);
      cards.push(
        <Card kind="koagulan" key={t1} title={t1}>
          <BarChart name="Penggunaan koagulan" unit="kg" categories={usage.categories} series={usage.series} />
        </Card>,
      );
    }
    if (!ytd) cards.push(longCard('koagulan', t2), longCard('koagulan', t3));
    else {
      const tawas = tawasByDate(ytd);
      const wk = sumByWeek(tawas, today);
      const mo = sumByMonth(tawas, today);
      cards.push(
        <Card kind="koagulan" key={t2} title={t2} note={`Tawas Serbuk ditambah Tawas Batu. ${stats(wk.map((b) => b.value), 'kg', 1, wk[wk.length - 1].partial) ?? ''}`.trim()}>
          <BarChart name="Penggunaan tawas per minggu" unit="kg" categories={cats(wk)} series={[{ name: 'Tawas (kg)', values: wk.map((b) => b.value) }]} />
        </Card>,
        <Card kind="koagulan" key={t3} title={t3} note={`Tawas Serbuk ditambah Tawas Batu. ${stats(mo.map((b) => b.value), 'kg', 1, mo[mo.length - 1].partial) ?? ''}`.trim()}>
          <BarChart name="Penggunaan tawas per bulan" unit="kg" categories={cats(mo)} series={[{ name: 'Tawas (kg)', values: mo.map((b) => b.value) }]} />
        </Card>,
      );
    }
  }

  if (cards.length === 0) return null;
  return <div className="ui-report-charts">{cards}</div>;
}
