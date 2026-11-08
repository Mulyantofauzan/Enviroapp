# ENVIRO Bagian 4b: PDF laporan bergaya slide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti ekspor PDF Laporan dengan halaman bergaya slide (Cuaca, satu halaman per pond, tabel Event) yang digambar dari data, plus satu endpoint total tawas seumur data.

**Architecture:** Fungsi murni menghitung model halaman dari `HistoryEntry[]` (`lib/pdf/dates.ts`, `pages.ts`); generator SVG mandiri menggambar grafik bergaya desain (`svg.ts`); `slides.ts` menyusun halaman `jspdf` dan menempel SVG yang dirasterkan lewat `svgToPng`; `export.ts` mengambil data dan merakit PDF; `Laporan.tsx` hanya memanggilnya. Satu endpoint Hono baru untuk total seumur data.

**Tech Stack:** React 18, Vitest + RTL (jsdom), `jspdf` + `jspdf-autotable` (sudah ada, dimuat lewat `import()`), Hono + D1 (API, Vitest pool workers).

**Spec:** `docs/superpowers/specs/2026-11-02-evo-report-pdf-design.md` (melanjutkan `2026-11-02-evo-report-design.md`)

## Global Constraints

- Halaman A4 landscape 842 x 595 pt, margin 28 pt, Helvetica; teks di luar jangkauan Helvetica menjadi `?` (`pdfSafe`).
- Warna persis: banner Cuaca `#B02318`, banner pond dan seri biru tua `#14306B`, kuning `#F5B83D`, merah seri/garis batas `#E5322D`, panel Cuaca `#F8E4D8` bingkai `#D9261C`, panel pond `#D6E8C2` bingkai `#7DB04B`, sel tabel Cuaca `#F3CDB8`, debit inlet `#4A90D9` dan outlet `#1A1A1A`.
- Tanpa batang oranye, footer, kotak nomor halaman, logo, kolom Shift. Halaman slide tanpa nomor halaman.
- Angka id-ID (`formatNumber`); tanggal tabel dan sumbu harian `19-Oct`; sumbu bulanan `Aug`; minggu `W{nomor ISO}`; nama bulan Inggris tiga huruf.
- Satu karung = 25 kg (konstanta `KG_PER_BAG`); tawas = Tawas Serbuk + Tawas Batu; debit L/s = m3/hari / 86,4.
- Semua jendela berakhir di `to` (akhir Periode): harian 7 hari, mingguan 5 minggu Senin-Minggu, bulanan 12 bulan kalender; hari setelah `to` tidak dihitung.
- Tidak ada karakter em dash di teks; pesan Bahasa Indonesia.
- Perintah uji: `npm test -w @evo/web` dan `npm test -w @evo/api`; tipe: `npx tsc --noEmit -p apps/web`, semua dari akar repo.

## Review Focus

1. Pond tanpa baku mutu: tidak ada garis pH Min/Max dan BML, tidak ada legenda garis, tidak crash.
2. Data kosong: hari tanpa catatan membuat celah pada grafik 1W, `0,0` di tabel; seri yang seluruhnya kosong atau nol tidak menghasilkan `NaN`/`Infinity` pada sumbu.
3. Batas tahun: nomor minggu ISO (2024-12-30 = W1, 2026-01-01 = W1, 2020-12-31 = W53), jendela 12 bulan lintas tahun, Year To Date mulai 1 Januari tahun `to`.
4. "Semua lokasi": halaman Cuaca hanya satu (cuaca tidak berlipat per pond), pond tanpa data tidak mendapat halaman, urutan pond menurut kode.
5. Karakter khusus dan nama panjang pada judul pond (`& < >`, emoji, 60 karakter): SVG tetap sah dan teks banner mengecil agar muat.
6. Hari setelah `to`, minggu dan bulan berjalan: rata-rata per hari memakai jumlah hari yang sudah lewat.

---

### Task 1: API total tawas seumur data

**Files:**
- Modify: `apps/api/src/entries/history.ts`
- Test: `apps/api/test/history-total.test.ts`

**Interfaces:**
- Produces: `GET /api/history/coagulant-total?to=YYYY-MM-DD[&sp=ID]` -> `{ ponds: { sp_id: string; first_date: string | null; 'Tawas Serbuk': number; 'Tawas Batu': number; Kapur: number }[] }`. Semua peran masuk (grup `requireAuth` yang sudah ada). `to` tidak sah atau lebih dari 366 hari setelah hari ini -> 400 `"Tanggal akhir tidak sah."`. Satu query agregat (`SELECT sp_id, type, SUM(stock_out), MIN(date) ... WHERE date <= ? [AND sp_id = ?] GROUP BY sp_id, type`); `first_date` = `MIN(date)` dari semua jenis pond itu.

- [ ] **Step 1: Tes gagal** `history-total.test.ts` (pakai `login`, `addPond`, `call` dari `helpers.ts`; isi tabel `coagulant` lewat `env.DB` atau PUT `/coagulant/:date/:sp/:type`): jumlah `stock_out` per jenis dan pond sampai `to` (baris setelah `to` tidak ikut); `Out` null dihitung 0; jenis tanpa baris = 0; dua pond menghasilkan dua entri dan `sp=` hanya satu; `first_date` adalah tanggal terawal pond itu; pond tanpa baris tidak muncul; `to` tidak sah (`2026-13-40`, kosong) dan `to` lebih dari setahun ke depan = 400 dengan pesan di atas; tanpa sesi = 401; Auditor, Manager, Operator, Admin semuanya 200.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api -- history-total`. Expected: FAIL (404).
- [ ] **Step 3:** Tambah rute `GET /coagulant-total` di `historyRoutes` sesuai bentuk respons di atas; pakai `isValidDate`.
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS (semua).
- [ ] **Step 5:** Commit `feat(api): total penggunaan koagulan seumur data`.

### Task 2: Jendela waktu dan nomor minggu ISO

**Files:**
- Create: `apps/web/src/lib/pdf/dates.ts`
- Test: `apps/web/src/lib/pdf/dates.test.ts`

**Interfaces:**
- Consumes: `addDays`, `mondayOf`, `addMonths` dari `lib/dates.ts`.
- Produces:
  - `isoWeek(date: string): number`
  - `monthShortEn(month: string): string` (`'2026-10'` -> `'Oct'`)
  - `dayLabel(date: string): string` (`'2026-10-19'` -> `'19-Oct'`)
  - `lastDays(to: string, n: number): string[]` (menaik, `to` terakhir)
  - `lastWeeks(to: string, n: number): { monday: string; label: string; days: number }[]` (menaik, `label = 'W' + isoWeek(monday)`, `days` = jumlah hari berjalan sampai `to` untuk minggu terakhir, selain itu 7)
  - `lastMonths(to: string, n: number): { month: string; label: string }[]` (menaik, label `Aug`)
  - `KG_PER_BAG = 25`, `bags(kg: number): number` (kg / 25, satu desimal)

- [ ] **Step 1: Tes gagal**: `isoWeek('2024-12-30')` = 1, `isoWeek('2026-01-01')` = 1, `isoWeek('2020-12-31')` = 53, `isoWeek('2026-10-25')` = 43, `isoWeek('2026-10-19')` = 43; `dayLabel('2026-10-19')` = `'19-Oct'`; `lastDays('2026-10-25', 7)` dari `2026-10-19` sampai `2026-10-25`; `lastWeeks('2026-10-25', 5)` memuat label `W39..W43` dengan `days` terakhir 7, dan untuk `to = '2026-10-21'` (Rabu) `days` terakhir 3; `lastMonths('2026-02-10', 12)` dimulai `2025-03` dan berakhir `Feb`, melintasi tahun; `bags(25)` = 1, `bags(100)` = 4, `bags(30)` = 1,2, `bags(0)` = 0.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- pdf/dates`. Expected: FAIL.
- [ ] **Step 3:** Implementasi (nomor minggu ISO dari hari Kamis minggu itu).
- [ ] **Step 4:** Jalankan lagi. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): jendela waktu dan minggu ISO untuk PDF`.

### Task 3: Model halaman Cuaca dan Pond

**Files:**
- Create: `apps/web/src/lib/pdf/pages.ts`
- Test: `apps/web/src/lib/pdf/pages.test.ts`

**Interfaces:**
- Consumes: `HistoryEntry` (`lib/report.ts`), `Pond` (`pond/PondContext`), `sumByWeek`, `sumByMonth`, `DayValue` (`lib/aggregate.ts`), `tawasByDate`, `rainByDate` (`lib/reportSeries.ts`), Task 2.
- Produces:
  - `type Pt = number | null`
  - `type Series = { categories: string[]; a: Pt[]; b: Pt[] }`
  - `type WeatherPage = { title: 'WEATHER MONITORING'; rows: { date: string; rain: number; hours: number; intensity: number }[]; summary: { rainyDays: number; rainMm: number; hours: number; maxIntensity: number }; w1: Series; w5: Series; m12: Series }` (`a` = rainfall mm, `b` = jam hujan; `w1` titik null bila hari tanpa catatan cuaca; `rows` selalu 7 baris, angka 0 untuk hari tanpa catatan)
  - `weatherPage(entries: HistoryEntry[], to: string): WeatherPage`
  - `type PondPage = { title: string; days: string[]; ph: { inlet: Pt[]; outlet: Pt[]; min: number | null; max: number | null }; tss: { inlet: Pt[]; outlet: Pt[]; limit: number | null }; debit: { inlet: Pt[]; outlet: Pt[] }; coag: { batu: Pt[]; serbuk: Pt[] }; weekly: { labels: string[]; totalKg: number[]; bags: number[]; avgPerDay: number[]; chart: Pt[] }; monthly: { labels: string[]; totalKg: number[]; bags: number[] }; ytdChart: { labels: string[]; values: Pt[] }; ytd: { kg: number; bags: number }; project: { kg: number; bags: number } }`
  - `pondTitle(p: Pick<Pond, 'code' | 'name'>): string` = `(code ? code + ' ' + name : name).toUpperCase() + ' MONITORING'`
  - `pondPage(entries: HistoryEntry[], pond: Pond, to: string, total: { serbuk: number; batu: number } | null): PondPage` (hanya entri `sp_id === pond.id`; `monthly` = 5 bulan terakhir dari 12; `project` dari `total`, 0 bila null; `ytd` = jumlah tawas 1 Januari tahun `to` sampai `to`)

- [ ] **Step 1: Tes gagal** `pages.test.ts`: Cuaca: intensity harian = rain / hours dan 0 bila jam 0; `summary.rainyDays` menghitung hari rainfall > 0; `summary.maxIntensity` = nilai harian tertinggi (bukan total / jam); hari tanpa catatan: baris `0`, `w1.a` null; `w5` memakai total per minggu (bukan rata-rata) dan label `W..`; `m12` total per bulan; hari setelah `to` diabaikan; dua entri pond pada tanggal sama dihitung sekali. Pond: `pondTitle({code:'SP 11', name:'LGG'})` = `'SP 11 LGG MONITORING'`, tanpa kode `'LGG MONITORING'`; pH `min`/`max` dari `thresholds.ph_outlet` dan `null` bila pond tanpa baku mutu, `tss.limit` dari `thresholds.tss_outlet.max`; debit `debit_*_m3d / 86.4` (1296 m3/hari = 15 L/s); `coag.batu`/`serbuk` per hari tanpa Kapur; `weekly.totalKg` = Serbuk + Batu per minggu, `bags` = kg/25, `avgPerDay` = total / 7 dan untuk minggu berjalan total / hari berjalan; `monthly` 5 bulan; `ytd` hanya dari 1 Januari (data Desember tahun lalu tidak ikut); `project` = `total.serbuk + total.batu`; entri pond lain tidak ikut; data kosong total tidak menghasilkan `NaN`.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- pdf/pages`. Expected: FAIL.
- [ ] **Step 3:** Implementasi (pakai agregasi yang sudah ada; satu konstanta `L_PER_S_DIVISOR = 86.4`).
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): model halaman Cuaca dan Pond`.

### Task 4: Generator SVG grafik

**Files:**
- Create: `apps/web/src/lib/pdf/svg.ts`
- Test: `apps/web/src/lib/pdf/svg.test.ts`

**Interfaces:**
- Consumes: `Pt` (Task 3).
- Produces:
  - `type Theme = { panel: string; border: string; tag: string }`; `WEATHER_THEME = { panel: '#F8E4D8', border: '#D9261C', tag: '#E5322D' }`, `POND_THEME = { panel: '#D6E8C2', border: '#7DB04B', tag: '#14306B' }`
  - `lineChartSvg(o: { width: number; height: number; title: string; theme: Theme; categories: string[]; series: { name: string; color: string; values: Pt[]; axis?: 'left' | 'right' }[]; decimals?: number; legend?: boolean; tag?: boolean }): string` (garis, titik, label berkotak berwarna bertulis putih, sumbu kiri dan opsional kanan, legenda bila `legend !== false`, label judul bila `tag !== false`)
  - `barChartSvg(o: { width: number; height: number; title: string; theme: Theme; categories: string[]; series: { name: string; color: string; values: Pt[] }[]; lines?: { name: string; color: string; value: number }[]; decimals?: number }): string` (batang berkelompok, label angka di atas batang, garis horizontal merah untuk `lines`, legenda memuat seri dan garis)
  - Semua keluaran: string SVG mandiri (`xmlns`, `viewBox`, atribut warna langsung, tanpa kelas CSS, tanpa `var()`), teks ter-escape lewat `xmlEscape` dari `lib/xlsx.ts`, huruf `Helvetica, Arial, sans-serif`.

- [ ] **Step 1: Tes gagal** (parse dengan `DOMParser` `image/svg+xml`, tanpa `parsererror`): bar chart 7 hari dua seri menghasilkan 14 `rect` batang dan label angka id-ID (`4,4`); `null` tidak menghasilkan batang atau label sedangkan nol tercatat menghasilkan label `0`; `lines` menghasilkan satu `line` merah per entri dan entri legenda "pH Min"; tanpa `lines` tidak ada garis dan tidak ada legenda garis; line chart dua sumbu: seri `axis: 'right'` memakai skala sendiri (nilai maksimum seri kanan jatuh di tinggi yang sama dengan nilai maksimum seri kiri), label `text` ada untuk tiap titik berdata, `null` memutus `path` (dua `path` untuk satu celah); semua `null` atau semua nol tidak menghasilkan `NaN` atau `Infinity` di atribut mana pun dan tetap menggambar sumbu; judul dengan `& < > "` dan emoji sah dan terbaca kembali tepat; tidak ada atribut `class` dan tidak ada string `var(`; `tag: false` tidak menggambar label judul; `legend: false` tidak menggambar legenda; panel memakai warna tema.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- pdf/svg`. Expected: FAIL.
- [ ] **Step 3:** Implementasi; skala sumbu "bagus" memakai `niceStep` dari `lib/scale.ts` dengan batas bawah 0 dan batas atas minimal satu langkah (menghindari pembagian nol).
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): generator SVG grafik bergaya slide`.

### Task 5: Penyusun PDF slide

**Files:**
- Create: `apps/web/src/lib/pdf/slides.ts`, `apps/web/src/lib/pdf/safe.ts`
- Test: `apps/web/src/lib/pdf/slides.test.ts`

**Interfaces:**
- Consumes: `WeatherPage`, `PondPage` (Task 3), `lineChartSvg`, `barChartSvg`, themes (Task 4), `svgToPng` (`lib/chartImage.ts`), `ReportSection`, `cellText` (`lib/report.ts`).
- Produces:
  - `pdfSafe(s: string): string` di `lib/pdf/safe.ts` (pindahan utuh dari `lib/pdf.ts`)
  - `type SlideInput = { weather: WeatherPage | null; ponds: PondPage[]; event: ReportSection | null }`
  - `buildSlidePdf(input: SlideInput, rasterize?: (s: { xml: string; width: number; height: number }) => Promise<{ dataUrl: string; width: number; height: number }>): Promise<Blob>` (`rasterize` awal `(s) => svgToPng(s, 3)`; `jspdf` dan `jspdf-autotable` dimuat lewat `import()` di dalam fungsi). Halaman Cuaca: banner, tabel (`autoTable`) dengan kepala dua tingkat dan baris ringkasan kuning, tiga grafik berdampingan (1W, 1M, 1Y). Halaman pond: banner, empat panel 2 x 2, kolom kanan (tabel WEEKLY, grafik MTD, tabel MONTHLY, grafik YTD, dua kotak Year To Date dan Project To Date). Halaman Event: tabel `autoTable` biasa berjudul "EVENT" dengan baris judul berulang dan "Halaman x dari y" hanya pada halaman tabel itu. Tanpa data sama sekali: satu halaman "Tidak ada data pada periode ini.". Judul banner mengecil (font 17 pt turun sampai 9 pt) agar muat 300 pt.

- [ ] **Step 1: Tes gagal** `slides.test.ts` (`rasterize` diganti fungsi yang mengembalikan PNG 1x1 sah; baca isi PDF dengan pembantu `allText`/`pages` seperti di `pdf.test.ts` lama): hanya Cuaca = 1 halaman dan 3 gambar; Cuaca + 2 pond = 3 halaman; satu halaman pond memuat 6 gambar (4 panel + MTD + YTD); judul "SP 11 LGG MONITORING" dan "WEATHER MONITORING" dapat dicari di isi; teks tabel (`Rainfall (mm)`, `Intensity (mm/hrs)`, `2 hari hujan`, `Total Tawas (kg)`, `Year To Date`, `Project To Date`) dapat dicari; event 200 baris menambah halaman dan memuat "Halaman 1 dari"; halaman slide tidak memuat "Halaman"; tidak ada `trusted` atau `reliable` di isi; tanpa apa pun menghasilkan PDF sah dengan teks "Tidak ada data pada periode ini."; judul pond 60 karakter dan berisi `&` tidak melempar galat; `pdfSafe` mempertahankan huruf Latin dan `³`, mengganti `☃` menjadi `?`; `rasterize` dipanggil sekali per grafik.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- pdf/slides`. Expected: FAIL.
- [ ] **Step 3:** Implementasi; satu fungsi `drawBanner`, `drawWeather`, `drawPond`, `drawEvent` privat; ukuran dan warna sesuai Global Constraints dan spec bagian 4 dan 5.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS. `lib/pdf.ts` lama dan layar belum disentuh di tugas ini (keduanya diganti di Task 6), jadi semua uji lama tetap hijau.
- [ ] **Step 5:** Commit `feat(web): penyusun PDF bergaya slide`.

### Task 6: Pengambilan data ekspor dan sambungan ke layar

**Files:**
- Create: `apps/web/src/lib/pdf/export.ts`
- Modify: `apps/web/src/screens/Laporan.tsx`, `apps/web/src/lib/chartImage.ts` (hapus `serializeChart`, `chartToPng`, `PROPS`; pertahankan `SerializedChart`, `svgToPng`), `apps/web/src/lib/chartImage.test.ts` (hapus uji `serializeChart` dan `chartToPng`)
- Delete: `apps/web/src/lib/pdf.ts`, `apps/web/src/lib/pdf.test.ts`
- Test: `apps/web/src/lib/pdf/export.test.ts`, `apps/web/src/screens/Laporan.test.tsx`

**Interfaces:**
- Consumes: `api` (`api/client`), `weatherPage`, `pondPage`, `pondTitle` (Task 3), `buildSlidePdf`, `SlideInput` (Task 5), `addDays` (`lib/dates.ts`), `ReportKind`, `ReportSection`, `HistoryEntry` (`lib/report.ts`), `Pond`.
- Produces: `buildPdfReport(o: { to: string; sp: string; kinds: ReportKind[]; ponds: Pond[]; eventSection: ReportSection | null; fetchJson?: typeof api; build?: typeof buildSlidePdf }): Promise<Blob>`:
  1. `/history?from={to-365}&to={to}` (+ `&sp=` bila `sp` diisi), satu permintaan;
  2. bila `kinds` memuat `air` atau `koagulan`: `/history/coagulant-total?to={to}` (+ `&sp=`);
  3. halaman Cuaca bila `kinds` memuat `cuaca`;
  4. halaman pond bila `kinds` memuat `air` atau `koagulan`: pond terpilih bila `sp`, selain itu pond aktif yang punya baris `water` atau `coagulant` dalam data (urut menurut `code` lalu `name`); tiap pond dengan `total` dari respons (atau null);
  5. `event: eventSection` hanya bila `kinds` memuat `event` dan `rows.length > 0`;
  6. kembalikan `build({ weather, ponds, event })`.
  Galat jaringan menjadi pesan Indonesia dari `api`; tidak ada pengambilan DOM.

- [ ] **Step 1: Tes gagal** `export.test.ts` (`fetchJson` dan `build` tiruan): satu permintaan `/history` dengan `from = to - 365`; `sp` memunculkan `&sp=`; `/history/coagulant-total` hanya dipanggil bila ada chip Air atau Koagulan; hanya chip Cuaca = tanpa halaman pond dan tanpa panggilan total; "Semua lokasi" = satu halaman pond per pond berdata, urut menurut kode, pond tanpa data dilewati, satu halaman Cuaca; pond terpilih tanpa data tetap mendapat halamannya; Event ikut hanya bila chip aktif dan ada baris; judul pond dari `pondTitle`; galat dari `fetchJson` ditolak apa adanya. Perbarui `Laporan.test.tsx`: hapus uji lama yang bergantung pada pemotretan DOM (`captured before first image`, `chartToPng`, `PdfChart`), tambah: "Ekspor PDF" memanggil `/history` setahun dari `to` dan mengunduh `laporan-evo-...pdf`; tombol dan pesan galat seperti sebelumnya; kedua tombol menunggu selama berjalan; ekspor ditolak bila total baris > 20.000.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- pdf/export Laporan`. Expected: FAIL.
- [ ] **Step 3:** Implementasi `buildPdfReport`; di `Laporan.tsx` ganti isi `exportPdf` dengan satu panggilan ke `buildPdfReport` (nilai `to`, `sp`, `kinds`, `ponds`, bagian Event dari `sections`); hapus pengumpulan SVG dan `legend` dari DOM; hapus kode mati (`PdfChart`, impor `serializeChart`, `lib/pdf.ts`, `lib/pdf.test.ts`).
- [ ] **Step 4:** Jalankan `npm test` dari akar, `npx tsc --noEmit -p apps/web`, dan `npm run build -w @evo/web`; periksa bahwa `jspdf` tetap potongan terpisah. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): ekspor PDF memakai halaman slide`.

### Task 7: Verifikasi, dokumen, laporan Delivery Gate

**Files:**
- Modify: `README.md`, `anti-slop/delivery-gate-2026-11-02.md`

- [ ] **Step 1:** Jalankan `npm test`, `npx tsc --noEmit -p apps/web`, `npm run build -w @evo/web`. Expected: lulus.
- [ ] **Step 2:** Jalankan `cd apps/api && npx wrangler dev --port 8799` (jangan hentikan server pengguna di 8787); data contoh satu tahun sudah ada di database lokal (pond SP-02); tambahkan satu pond bernama kode `SP 11` nama `LGG` beserta beberapa catatan air dan koagulan bila perlu agar judul sampel terlihat.
- [ ] **Step 3:** Di Chrome nyata (skrip CDP seperti `laporan.mjs`, unduhan ke `/tmp/evo-dl2`): ekspor PDF dengan chip Cuaca, Air, Koagulan sebagai Manager untuk satu pond dan untuk "Semua lokasi"; render halaman dengan `pdfpage` (PDFKit) dan bandingkan berdampingan dengan `Design/Laporan Cuaca.pdf` dan `Design/Laporan pond.pdf` (render dengan alat yang sama): tata letak, warna, judul "SP 11 LGG MONITORING", label, dan kolom ringkasan; catat selisih yang disengaja (tanpa batang oranye, footer, nomor halaman, logo, Shift). Perbaiki selisih tata letak yang tidak disengaja.
- [ ] **Step 4:** Perbarui README (bagian Laporan: PDF bergaya slide, endpoint `coagulant-total`) dan laporan Delivery Gate; commit `docs: verifikasi PDF slide Laporan`.
