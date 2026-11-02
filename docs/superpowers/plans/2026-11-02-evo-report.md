# EVO Bagian 4: Laporan, grafik, dan ekspor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layar `/laporan` (Manager, Admin, Auditor) dengan filter, pratinjau tabel, sembilan grafik berlabel data, dan ekspor Excel (tabel) serta PDF (tabel + grafik); label data juga pada grafik dashboard.

**Architecture:** Semua di klien tanpa API baru. Fungsi murni (`aggregate`, `labels`, `report`, `reportSeries`, `windows`) menjadi satu sumber untuk pratinjau, grafik, Excel, dan PDF. Grafik SVG buatan sendiri diperluas (label) dan satu komponen `BarChart` ditambah. PDF mengambil gambar dari SVG yang sudah tampil di layar.

**Tech Stack:** React 18, Vite, Vitest + RTL (jsdom), `fflate` (sudah ada, dipakai penulis xlsx), `jspdf` + `jspdf-autotable` (baru, dimuat dengan `import()`).

**Spec:** `docs/superpowers/specs/2026-11-02-evo-report-design.md`

## Global Constraints

- Pesan antarmuka Bahasa Indonesia; tanpa karakter em dash di teks mana pun; zona waktu WITA; angka id-ID lewat `formatNumber` (`@evo/shared`).
- Tidak ada endpoint API baru. Rentang `/history` maksimal 366 hari (selisih), `/events` maksimal 62 hari per permintaan.
- Target sentuh 44 px, tanpa overflow horizontal di 360 px; tema warna tetap token Figma (`styles/tokens.css`).
- Excel hanya tabel; grafik hanya di layar dan PDF. Total baris ekspor maksimal 20.000.
- Label data: sampai 14 titik semua berlabel, lebih dari itu pertama, terakhir, tertinggi, terendah; teks minimal 11 px.
- `jspdf` dan `jspdf-autotable` tidak boleh masuk muatan awal (hanya `import()` saat Ekspor PDF).
- Perintah uji: `npm test -w @evo/web`; tipe: `npx tsc --noEmit -p apps/web`; keduanya dari akar repo.

## Review Focus

1. Pond tanpa baku mutu: tidak ada sel merah dan tidak ada pita pada grafik, tidak error.
2. Minggu atau bulan tanpa satu pun data: celah (null), bukan nol; grafik tanpa data sama sekali menampilkan pesan kosong.
3. Pergantian tahun: bucket minggu dan bulan Des-Jan benar, label bulan tidak ambigu antar tahun.
4. Jendela Event pada batas 62, 63, dan 366 hari: tanpa tumpang tindih dan tanpa duplikat saat digabung.
5. Karakter khusus (`& < > " '`, emoji, karakter kontrol) pada judul jadwal, nama pond, nama pembuat di xlsx dan PDF; nama lembar unik dan sah.
6. "Semua lokasi": cuaca tidak berlipat ganda per pond, koagulan dijumlahkan lintas pond, grafik air meminta satu lokasi.

---

### Task 1: Agregasi minggu dan bulan

**Files:**
- Create: `apps/web/src/lib/aggregate.ts`
- Test: `apps/web/src/lib/aggregate.test.ts`

**Interfaces:**
- Produces:
  - `type DayValue = { date: string; value: number | null }`
  - `type Bucket = { key: string; label: string; value: number | null; partial: boolean }`
  - `meanByWeek(days: DayValue[], today: string, n?: number): Bucket[]` (n awal 5), `sumByWeek(...)` sama
  - `meanByMonth(days: DayValue[], today: string, n?: number): Bucket[]` (n awal 12), `sumByMonth(...)` sama
  - Urutan lama ke baru. `key` minggu = tanggal Senin, bulan = `YYYY-MM`. `label` minggu = `dayMonth(senin)` (mis. "27 Okt"), bulan = singkatan bulan id-ID + tahun dua digit (mis. "Nov 26"). `partial` benar untuk minggu yang memuat `today` bila `today` bukan Minggu, dan bulan berjalan bila `today` bukan hari terakhir bulan. Data setelah `today` diabaikan.

- [ ] **Step 1: Tes gagal** `aggregate.test.ts` dengan `today = '2026-11-02'` (Senin): `meanByWeek` menghasilkan 5 bucket dengan key `2026-10-05,10-12,10-19,10-26,11-02`; rata-rata hanya dari hari berdata (`[10, null, 20]` dalam satu minggu menghasilkan 15); minggu tanpa data satupun `value === null`; hari setelah `today` diabaikan; bucket terakhir `partial === true`; `today = '2026-11-01'` (Minggu) membuat bucket terakhir `partial === false`. `sumByWeek` menjumlahkan, null bila tanpa data, 0 bila hari berdata bernilai 0. `meanByMonth`/`sumByMonth` dengan `today = '2026-01-15'` menghasilkan 12 bucket dari `2025-02` sampai `2026-01` (batas tahun), label `"Jan 26"`, dan bucket Januari `partial`. Bulan terakhir tanggal 31 tidak partial.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- aggregate`. Expected: FAIL (modul tidak ada).
- [ ] **Step 3:** Implementasi dengan `addDays`, `mondayOf`, `addMonths` dari `lib/dates.ts` (satu fungsi `bucketize` privat dipakai keempatnya).
- [ ] **Step 4:** Jalankan lagi. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): agregasi mingguan dan bulanan`.

### Task 2: Aturan label dan label pada garis (TrendChart)

**Files:**
- Create: `apps/web/src/lib/labels.ts`
- Modify: `apps/web/src/components/TrendChart.tsx`, `PhChart.tsx`, `apps/web/src/styles/ui.css`
- Test: `apps/web/src/lib/labels.test.ts`, `apps/web/src/components/TrendChart.test.tsx` (tambahan)

**Interfaces:**
- Produces:
  - `labeledIndexes(values: (number | null)[], max?: number): Set<number>` (max awal 14): indeks nilai non-null; bila jumlahnya ≤ max semuanya, bila lebih hanya pertama, terakhir, tertinggi, terendah (kemunculan pertama).
  - `labelAnchor(x: number, left: number, right: number, textWidth: number): 'start' | 'middle' | 'end'` agar teks tidak keluar area (`start` bila `x - textWidth/2 < left`, `end` bila `x + textWidth/2 > right`).
  - `TrendChart` props tambahan: `decimals?: number` (maxDecimals untuk label, awal 1), `hide?: 'inlet'` (menghapus garis, legenda, dan kolom tabel inlet), `outletLabel?: string` (awal "Outlet"), `inletLabel?: string`. `PhChart` meneruskan `decimals={2}`. Label outlet di atas titik, label inlet di bawah; kelas `ui-chart__label` (11 px, `fill: var(--text)`), label titik abnormal `ui-chart__label--bad` (danger tebal).

- [ ] **Step 1: Tes gagal**: `labeledIndexes([1,2,3], 14)` = {0,1,2}; 20 nilai (maks di indeks 7, min di indeks 3) = {0,19,7,3}; null dilewati dan tidak dihitung; semua null = kosong; nilai sama semua memilih indeks pertama untuk tertinggi dan terendah tanpa duplikat. `labelAnchor` mengembalikan `start`/`end`/`middle` di tepi kiri/kanan/tengah. TrendChart: 7 titik outlet menghasilkan 7 elemen `text.ui-chart__label` bertulis format id-ID; 20 titik menghasilkan empat; inlet dan outlet pada hari yang sama punya label berbeda posisi (`y` outlet lebih kecil dari `y` titiknya, `y` inlet lebih besar); `hide="inlet"` tidak merender elemen inlet maupun legenda "Inlet"; `outletLabel="Curah hujan"` tampil di legenda; titik abnormal berlabel `ui-chart__label--bad`.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- labels TrendChart`. Expected: FAIL.
- [ ] **Step 3:** Implementasi sesuai tanda tangan; jangan mengubah garis, pita, dan tabel `ui-sr` selain menghormati `hide`.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS (uji dashboard lama tetap hijau).
- [ ] **Step 5:** Commit `feat(web): label data pada grafik garis`.

### Task 3: Label pada RainChart dan BarChart baru

**Files:**
- Modify: `apps/web/src/components/RainChart.tsx`, `apps/web/src/styles/ui.css`
- Create: `apps/web/src/components/BarChart.tsx`
- Test: `apps/web/src/components/RainChart.test.tsx` (tambahan), `apps/web/src/components/BarChart.test.tsx`

**Interfaces:**
- Consumes: `labeledIndexes`, `labelAnchor` (Task 2).
- Produces:
  - `type BarCategory = { key: string; label: string; partial?: boolean }`
  - `type BarSeries = { name: string; values: (number | null)[] }` (panjang sama dengan `categories`)
  - `BarChart({ name, unit, categories, series, decimals? }: {...})`: batang tunggal bila satu seri, berkelompok bila lebih; label data di atas tiap batang dengan aturan 14 titik dihitung per seri bila total batang berdata > 14; kategori `partial` diberi akhiran " (berjalan)" di keterangan teks dan sumbu memakai label singkat tanpa akhiran; null = tanpa batang (celah); semua null mengembalikan `<p class="ui-muted">Belum ada data pada rentang ini.</p>`; `<figure class="ui-chart" data-report-chart>`, `role="img"` dengan `aria-label` memuat nama, satuan, nilai tertinggi, dan terakhir; tabel `ui-sr` berisi semua nilai; legenda memakai kelas `ui-legend__bar ui-legend__bar--0/1/2`; batang kelas `ui-chart__bar ui-chart__bar--0/1/2` (Kapur primer, Tawas Serbuk air, Tawas Batu warning).
  - `RainChart` tetap memakai antarmuka lama, kini dengan label (desimal 1) memakai aturan yang sama.

- [ ] **Step 1: Tes gagal**: BarChart 5 kategori satu seri berlabel lima teks; tiga seri dengan tujuh kategori (21 batang) berlabel empat per seri; nilai null tidak punya batang dan tidak berlabel; semua null menampilkan pesan kosong tanpa `svg`; kategori partial muncul sebagai "(berjalan)" di `aria-label` atau tabel `ui-sr`; tinggi batang proporsional (batang 20 dua kali tinggi batang 10); nilai 0 tampil berlabel "0" dengan tinggi minimal 0. RainChart: tujuh batang berlabel tujuh, empat puluh hari berlabel empat.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- BarChart RainChart`. Expected: FAIL.
- [ ] **Step 3:** Implementasi; skala sumbu memakai `niceStep` yang sama dengan RainChart (ekstrak ke `lib/scale.ts` bila ingin dipakai bersama, tanpa mengubah perilaku `TrendChart`).
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): BarChart dan label data pada grafik batang`.

### Task 4: Model tabel laporan

**Files:**
- Create: `apps/web/src/lib/report.ts`
- Modify: `apps/web/src/lib/dates.ts` (tambah `dateText(iso)` = `"2 Nov 2026"`), `apps/web/src/screens/Riwayat.tsx` (pakai `dateText` dari `lib/dates`)
- Test: `apps/web/src/lib/report.test.ts`

**Interfaces:**
- Produces:
  - `type ReportKind = 'cuaca' | 'air' | 'koagulan' | 'event'`
  - `type Cell = string | number | null`
  - `type ReportColumn = { key: string; header: string; kind: 'text' | 'number'; decimals?: number }`
  - `type ReportRow = { cells: Record<string, Cell>; bad: string[] }` (`bad` berisi key kolom)
  - `type ReportSection = { id: ReportKind; title: string; columns: ReportColumn[]; rows: ReportRow[] }`
  - `type HistoryEntry` (pindah dari Riwayat: `{ date; sp_id; weather: {rainfall_mm; rain_hours} | null; water: {ph_inlet; ph_outlet; tss_inlet; tss_outlet; debit_inlet_m3d; debit_outlet_m3d} | null; coagulant: {type; stock_in; stock_out; stock_remaining; staleRemaining}[] }`), diekspor dari `report.ts` dan dipakai Riwayat.
  - `buildReport(input: { entries: HistoryEntry[]; events: EventOccurrence[]; ponds: Pond[]; kinds: ReportKind[] }): ReportSection[]` (hanya bagian di `kinds`, urutan cuaca, air, koagulan, event).
  - `cellText(col: ReportColumn, v: Cell): string` (angka id-ID dengan `col.decimals` awal 3, null atau string kosong menjadi `–`).
  - `reportRowCount(sections: ReportSection[]): number`.
- Kolom persis mengikuti tabel di spec bagian 4; `key` kolom: cuaca `date,rain,hours`; air `date,pond,phi,pho,tssi,tsso,di,do`; koagulan `date,pond,type,in,out,left,note`; event `due,title,freq,place,status,by,at,evidence`. Tanggal diisi string `dateText`; urut tanggal terbaru di atas; event urut tenggat terbaru di atas. Cuaca satu baris per tanggal (duplikat antar pond dibuang). `bad` hanya `pho` dan `tsso` bila `isOutOfLimit` terhadap baku mutu pond itu (`thresholds.ph_outlet`, `thresholds.tss_outlet`). Status event: `done` → "Selesai" atau "Selesai (terlambat)" bila `late`, `overdue` → "Overdue", `today` → "Hari ini", `upcoming` → "Mendatang". `at` = `witaStamp` atau null. `place` = nama pond (`pondLabel`) atau "Semua lokasi".

- [ ] **Step 1: Tes gagal**: urutan baris terbaru di atas; sel kosong null; `bad` berisi `pho` untuk pH 5,8 dengan baku mutu 6-9 dan kosong bila pond tidak punya baku mutu atau pond tidak ditemukan; inlet tidak pernah `bad`; cuaca dari dua entri berbeda pond pada tanggal sama menjadi satu baris; koagulan `note` = "Selisih stok" bila `staleRemaining`; semua label status event; event tanpa pond = "Semua lokasi"; `kinds=['event']` hanya menghasilkan satu bagian; judul bagian "Cuaca", "Air Permukaan", "Koagulan", "Event"; `cellText` memberi `–` untuk null dan `1.278,7` untuk 1278.7 dengan decimals 1; `reportRowCount` menjumlah semua baris.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- report`. Expected: FAIL.
- [ ] **Step 3:** Implementasi; Riwayat memakai tipe `HistoryEntry` dan `dateText` baru tanpa perubahan perilaku.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): model tabel laporan`.

### Task 5: Penulis xlsx

**Files:**
- Create: `apps/web/src/lib/xlsx.ts`
- Test: `apps/web/src/lib/xlsx.test.ts`

**Interfaces:**
- Consumes: `ReportSection`, `ReportColumn`, `Cell` (Task 4).
- Produces:
  - `type ReportMeta = { title: string; lokasi: string; periode: string; dibuatOleh: string; dibuatPada: string }`
  - `buildXlsx(meta: ReportMeta, sections: ReportSection[]): Uint8Array`: berkas ZIP dengan `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/styles.xml`, `xl/worksheets/sheet1..N.xml`; lembar 1 "Ringkasan" (judul, Lokasi, Periode, Dibuat oleh, Dibuat pada, lalu satu baris per bagian "Cuaca: 31 baris"); lalu satu lembar per bagian berjudul sama dengan `section.title`. String `inlineStr`; angka sebagai `<c t="n">` dengan nilai asli; sel null tidak ditulis; baris judul kolom bergaya tebal berlatar `E6F4F1` dan dibekukan (`pane ySplit=1`); sel `bad` bergaya merah tebal berlatar `FDE8E8`; format angka dari `decimals` (`0`, `0.0`, `0.00`, `0.###` untuk awal); lebar kolom = panjang teks terpanjang + 2, maksimal 40; `sanitizeSheetName(name, used: Set<string>): string` (hapus `[]:*?/\`, potong 31, unik dengan akhiran " 2", " 3").
  - `xmlEscape(s: string): string` mengganti `& < > " '` dan membuang karakter kontrol selain tab, LF, CR.

- [ ] **Step 1: Tes gagal**: buka hasil dengan `unzipSync` dan `DOMParser`: semua berkas kerangka ada dan XML-nya tersusun baik; jumlah lembar = bagian + 1 dan urutan nama benar di `workbook.xml`; angka 5.8 tertulis `<v>5.8</v>` bertipe angka; judul `A & B <x> "q"` ter-escape dan dapat dibaca kembali tepat; karakter `\u0001` dibuang; emoji lolos utuh; sel `bad` memakai indeks gaya merah (periksa `s` pada sel dan definisi font merah di `styles.xml`); sel null tidak ada di XML; `sanitizeSheetName('A/B:C*?[x]')` tidak memuat karakter terlarang dan ≤ 31 karakter; dua bagian bernama sama menghasilkan nama berbeda; nol baris menghasilkan lembar berisi baris judul saja.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- xlsx`. Expected: FAIL.
- [ ] **Step 3:** Implementasi dengan `zipSync` (`level: 6` untuk XML); tidak ada tabel string bersama.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): penulis xlsx`.

### Task 6: Jendela data dan deret grafik

**Files:**
- Create: `apps/web/src/lib/windows.ts`, `apps/web/src/lib/reportSeries.ts`, `apps/web/src/hooks/useReportData.ts`
- Test: `apps/web/src/lib/windows.test.ts`, `apps/web/src/lib/reportSeries.test.ts`, `apps/web/src/hooks/useReportData.test.tsx`

**Interfaces:**
- Consumes: `HistoryEntry` (Task 4), `DayValue` (Task 1), `api`.
- Produces:
  - `eventWindows(from: string, to: string, max?: number): [string, string][]` (max awal 62 hari inklusif): jendela berurutan menutup `from..to` tanpa tumpang tindih; `from > to` mengembalikan `[]`.
  - `periodDays(from: string, to: string): number` (inklusif) dan `validatePeriod(from, to): string | null` (pesan "Tanggal awal harus sebelum tanggal akhir." atau "Pilih rentang 366 hari atau kurang." atau null).
  - `fillDates(from: string, to: string): string[]`.
  - `rainByDate(entries: HistoryEntry[]): DayValue[]` (menaik, dedupe per tanggal).
  - `waterByDate(entries: HistoryEntry[], spId: string, from: string, to: string): { date: string; ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null; debit_outlet_m3d: number | null }[]` (semua tanggal terisi, null bila tanpa data).
  - `coagUsageDaily(entries: HistoryEntry[], from: string, to: string): { date: string; Kapur: number | null; 'Tawas Serbuk': number | null; 'Tawas Batu': number | null }[]` (jumlah `stock_out` lintas pond).
  - `tawasByDate(entries: HistoryEntry[]): DayValue[]` (Serbuk + Batu).
  - `useReportData(opts: { from: string; to: string; sp: string; kinds: ReportKind[]; today: string | null }): { entries: HistoryEntry[] | null; events: EventOccurrence[] | null; ytd: HistoryEntry[] | null; loading: boolean; progress: string; error: string }`: memuat `/history?from&to[&sp]` (periode terpilih), `/history` dari `today - 365` sampai `today` untuk `ytd` (`meanByMonth` dan `sumByMonth` memotong ke 12 bulan kalender) hanya bila ada chip Cuaca atau Koagulan, dan `/events?from&to[&sp]` per jendela berurutan hanya bila chip Event aktif (`progress` "Memuat event 2 dari 5"); perubahan parameter membuang hasil terlambat (nomor generasi); galat jendela event menyebut rentang tanggalnya.

- [ ] **Step 1: Tes gagal**: `eventWindows('2026-01-01','2026-01-31')` satu jendela; 62 hari satu jendela; 63 hari dua jendela `[1..62],[63..63]`; 366 hari tepat enam jendela; tanpa tumpang tindih dan gabungan sama dengan rentang; `from > to` kosong. `validatePeriod` untuk 367 hari inklusif menolak, 366 menerima. `rainByDate` membuang duplikat pond; `waterByDate` hanya pond yang diminta dan mengisi hari kosong dengan null; `coagUsageDaily` menjumlah dua pond dan Out null dihitung 0 hanya bila hari itu ada baris, kosong tetap null; `tawasByDate` tidak menyertakan Kapur. Hook: pengambilan `/history` memuat `sp` hanya bila diisi; `/events` dipanggil per jendela berurutan (mock mencatat urutan) hanya bila `kinds` memuat `event`; `ytd` tidak diambil bila hanya chip Air aktif; hasil yang datang setelah parameter berubah dibuang; galat jendela event berisi tanggal jendela.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- windows reportSeries useReportData`. Expected: FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): jendela data dan deret grafik laporan`.

### Task 7: Layar Laporan, grafik, dan ekspor Excel

**Files:**
- Create: `apps/web/src/screens/Laporan.tsx`, `apps/web/src/components/ReportCharts.tsx`, `apps/web/src/lib/download.ts`
- Modify: `apps/web/src/screens/Eviden.tsx` (pakai `download.ts`), `apps/web/src/styles/ui.css`
- Test: `apps/web/src/screens/Laporan.test.tsx`, `apps/web/src/lib/download.test.ts`

**Interfaces:**
- Consumes: `buildReport`, `cellText`, `reportRowCount` (T4), `buildXlsx`, `ReportMeta` (T5), `useReportData`, `validatePeriod`, series builders (T6), `TrendChart`, `PhChart`, `BarChart`, `meanByWeek` dan kawan-kawan (T1, T2, T3), `DataTable`, `Segmented`, `usePond`, `useEventSummary`.
- Produces:
  - `saveBlob(blob: Blob, filename: string): void` (pola unduhan Eviden: `createObjectURL`, anchor `download`, revoke setelah 1 detik); Eviden memakainya tanpa perubahan perilaku.
  - `reportFilename(lokasi: string, from: string, to: string, ext: 'xlsx' | 'pdf'): string` = `laporan-evo-{lokasi}-{from}-{to}.{ext}`, lokasi dibersihkan `[^A-Za-z0-9._-]+` menjadi `_`, "Semua lokasi" menjadi `semua`.
  - `ReportCharts({ kinds, entries, ytd, spId, from, to, today })`: kartu grafik sesuai tabel spec 4b, tiap kartu `<section class="ui-card" data-report-chart-card>` berjudul h2 dan memuat keterangan teks; grafik air memperlihatkan "Pilih satu lokasi untuk melihat grafik air permukaan." bila `spId === ''`; grafik curah 7 hari terakhir memakai `TrendChart hide="inlet" outletLabel="Curah hujan" decimals={1}`.
  - `Laporan()` di rute `/laporan`: kepala "Laporan" dengan subjudul "Tarik data dan unduh untuk presentasi"; Lokasi (awal pond aktif) dan Periode (Segmented "7 hari", "30 hari", "Bulan ini", "Bulan lalu", "Atur sendiri" dengan dua kolom tanggal; awal 7 hari); chip Cuaca, Air Permukaan, Koagulan aktif dan Event mati (`aria-pressed`, chip terakhir tidak bisa dimatikan); Segmented pilihan pratinjau antar bagian aktif; `DataTable` 50 baris dengan "Pratinjau {tampil} dari {total} baris"; catatan debit dan sel merah; tombol "Ekspor Excel (.xlsx)" (tombol "Ekspor PDF" ditambahkan di Task 8); keadaan memuat, kosong "Tidak ada data pada periode ini.", galat `role="alert"`; ekspor ditolak bila `reportRowCount > 20000` dengan pesan "Ada {n} baris. Persempit periode agar tidak lebih dari 20.000."

- [ ] **Step 1: Tes gagal** `Laporan.test.tsx` (mock `/history`, `/events`, `/events/summary`, `/ponds` lewat `mockApi`): judul dan subjudul; awal Periode 7 hari dan `from`/`to` di `/history` sesuai hari ini dari server; memilih "30 hari" mengubah `from`; "Atur sendiri" dengan rentang 367 hari menampilkan pesan dan menonaktifkan ekspor; chip terakhir tidak bisa dimatikan; Event mati tidak memanggil `/events` dan menyalakannya memanggil per jendela; pratinjau tabel air menandai sel pH merah; keterangan "Pratinjau 50 dari 60 baris" untuk 60 baris; grafik: chip Cuaca menampilkan tiga grafik curah hujan berlabel, "Semua lokasi" menampilkan pesan pilih lokasi di kartu air tetapi tetap menampilkan grafik koagulan; keadaan kosong dan galat; "Ekspor Excel (.xlsx)" memicu unduhan bernama `laporan-evo-SP-02_Pit_Selatan-{from}-{to}.xlsx` dan isi Blob dapat di-`unzipSync` menjadi enam berkas kerangka lebih lembar; tombol nonaktif tanpa baris; hasil terlambat dari Lokasi lama dibuang; akses Operator diarahkan ke beranda (uji di `nav.test.tsx` Task 9). `download.test.ts`: nama berkas dibersihkan.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- Laporan download`. Expected: FAIL.
- [ ] **Step 3:** Implementasi; CSS kisi grafik `.ui-report-charts` satu kolom di HP dan dua kolom ≥ 760 px, kontrol memakai kelas `ui-chips` dan `ui-seg` yang sudah ada.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): layar Laporan dengan grafik dan ekspor Excel`.

### Task 8: Ekspor PDF dengan grafik

**Files:**
- Modify: `apps/web/package.json` (`jspdf`, `jspdf-autotable`), `apps/web/src/screens/Laporan.tsx`
- Create: `apps/web/src/lib/pdf.ts`, `apps/web/src/lib/chartImage.ts`
- Test: `apps/web/src/lib/pdf.test.ts`, `apps/web/src/lib/chartImage.test.ts`, `apps/web/src/screens/Laporan.test.tsx` (tambahan)

**Interfaces:**
- Consumes: `ReportSection`, `ReportMeta`, `cellText` (T4, T5).
- Produces:
  - `serializeChart(svg: SVGSVGElement): { xml: string; width: number; height: number }`: salinan SVG dengan `xmlns`, atribut `width`/`height` dari `viewBox`, dan gaya komputasi kelas `ui-chart*` ditanam sebagai atribut `fill`/`stroke`/`stroke-width`/`font` agar tampil benar di luar halaman.
  - `chartToPng(svg: SVGSVGElement, scale?: number): Promise<{ dataUrl: string; width: number; height: number }>` (skala awal 2; gambar lewat `Image` dan kanvas, `Promise` ditolak bila gagal dimuat).
  - `type PdfChart = { section: ReportKind; title: string; dataUrl: string; width: number; height: number }`
  - `buildPdf(meta: ReportMeta, sections: ReportSection[], charts: PdfChart[]): Promise<Blob>`: A4 lanskap, `jspdf` dan `jspdf-autotable` lewat `import()`; blok kepala sama dengan Ringkasan; tiap bagian: judul teks, tabel (baris judul berulang, sel `bad` teks merah tebal berlatar merah muda, sel kosong `–` lewat `cellText`), lalu grafik bagian itu (`PdfChart.section` memilih bagian, urutan array = urutan di layar, judul grafik sebagai teks PDF di atas gambar); kaki "Halaman x dari y"; karakter di luar jangkauan Helvetica diganti `?`.
  - Tombol "Ekspor PDF" di `Laporan`: mengumpulkan `svg` di dalam `[data-report-chart-card]`, memanggil `chartToPng` untuk tiap SVG, lalu `buildPdf`, lalu `saveBlob`; menampilkan "Menyiapkan…" dan menonaktifkan kedua tombol selama berjalan; galat ditampilkan `role="alert"`.

- [ ] **Step 1: Tes gagal**: `serializeChart` menghasilkan XML dengan `xmlns` dan `viewBox`→`width`/`height`, menanam `stroke` dari kelas `ui-chart__outlet`, dan lolos `DOMParser` tanpa `parsererror`. `buildPdf` (jsPDF berjalan di jsdom; `addImage` untuk PNG kecil nyata): hasil Blob berukuran > 0, ByteStream awal `%PDF`, banyak baris (200) menghasilkan lebih banyak halaman daripada 5 baris (hitung `/Type /Page` pada isi biner), judul dan sel dapat dicari di isi (`Cek pompa`), karakter `☃` tidak membuat penolakan, jumlah gambar tertanam = jumlah `charts` (hitung `/Subtype /Image`), nol bagian tetap menghasilkan PDF sah. Layar: "Ekspor PDF" memanggil ekspor (stub `chartToPng` dan `buildPdf` diganti dengan `vi.mock`), menonaktifkan tombol selama berjalan, memicu unduhan `laporan-evo-...pdf`; kegagalan menampilkan pesan dan tidak mengunduh; `jspdf` tidak diimpor sebelum tombol ditekan (`vi.mock` dengan penghitung pemuatan).
- [ ] **Step 2:** Jalankan `npm install -w @evo/web jspdf jspdf-autotable` lalu `npm test -w @evo/web -- pdf chartImage Laporan`. Expected: FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npm test` dari akar, `npx tsc --noEmit -p apps/web`, dan `npm run build -w @evo/web`; periksa keluaran build bahwa `jspdf` berada di potongan terpisah (bukan di `index-*.js`). Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): ekspor PDF dengan grafik`.

### Task 9: Navigasi, rute, dan hak akses

**Files:**
- Modify: `apps/web/src/nav/nav.ts`, `apps/web/src/App.tsx`
- Test: `apps/web/src/nav/nav.test.tsx`

**Interfaces:**
- Produces: rute `/laporan` dibungkus `RequireRole` dengan `['Manager','Admin','Auditor']`; `navFor('Manager').tabs` berlabel `['Beranda','Kalender','Laporan','Akun']`; `navFor('Auditor').tabs` `['Kalender','Riwayat','Eviden','Laporan','Akun']`; Admin mendapat "Laporan" di `more`; Operator tidak ada (tab maupun `more`). Ikon `file` atau `clipboard` yang sudah ada.

- [ ] **Step 1: Tes gagal**: label tab per peran persis seperti di atas; `more` Admin memuat "Laporan"; Operator tidak memuat "Laporan" di tab, `more`, maupun `railFor`; Operator membuka `/laporan` mendarat di beranda (`Halo, Rudi`); Auditor membuka `/laporan` melihat judul "Laporan"; tautan "Laporan" pada rel samping Manager.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- nav`. Expected: FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npm test` dari akar dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): navigasi Laporan`.

### Task 10: Verifikasi, dokumen, laporan Delivery Gate

**Files:**
- Modify: `README.md`, `anti-slop/delivery-gate-2026-11-02.md`

- [ ] **Step 1:** Jalankan `npm test`, `npx tsc --noEmit -p apps/web`, `npm run build -w @evo/web`. Expected: lulus.
- [ ] **Step 2:** Migrasi lokal sudah ada; jalankan `cd apps/api && npx wrangler dev --port 8799` (jangan hentikan server pengguna di 8787), isi data uji beberapa hari lintas dua pond bila perlu lewat `curl`, termasuk satu nilai di luar baku mutu dan satu judul event berisi `&`.
- [ ] **Step 3:** Di Chrome nyata (skrip CDP seperti `bukti.mjs`, unduhan ke `/tmp/evo-dl`): sebagai Manager buka `/laporan`; ekspor Excel dan PDF; buka `.xlsx` lewat `unzip` dan periksa lembar, angka asli, sel merah (bila `openpyxl` tersedia di venv sementara di scratchpad, baca juga lewat itu); render PDF (Chrome headless membuka `file://` dan tangkapan layar halaman) dan baca gambar grafiknya; periksa label data pada semua sembilan grafik dan pada dashboard; Auditor dapat membuka, Operator tidak.
- [ ] **Step 4:** Ukur overflow dan target sentuh di 360 dan 1200 px untuk Laporan dan dashboard; baca tangkapan layar.
- [ ] **Step 5:** Perbarui README (bagian Laporan, dua format, catatan "Excel tanpa grafik") dan laporan Delivery Gate; commit `docs: verifikasi bagian Laporan`.
