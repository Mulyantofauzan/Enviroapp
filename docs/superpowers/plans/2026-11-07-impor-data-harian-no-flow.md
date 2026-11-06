# Impor data harian dan no flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Debit tampil dalam L/s, hari no flow (debit outlet 0) dikecualikan dari kepatuhan dan tampil sebagai "No flow", dan Admin bisa mengimpor cuaca, air, dan koagulan harian dari satu templat Excel.

**Architecture:** Database tetap menyimpan m³/s; konversi ke L/s ada di helper `@evo/shared` dan di batas tampilan/input. No flow dideteksi dari nilai (`debit_outlet = 0`), tanpa kolom baru. Impor mengikuti pola impor event: parsing dan validasi baris di `packages/shared`, endpoint `POST /entries/import` dengan `dry`, pembaca xlsx klien yang sudah ada, layar pratinjau-lalu-konfirmasi.

**Tech Stack:** Hono + D1 (API), React + Vite (web), vitest (shared, API via workers pool, web via jsdom), fflate.

**Spec:** `docs/superpowers/specs/2026-11-07-impor-data-harian-no-flow-design.md`

## Global Constraints
- Database tidak berubah: tanpa migrasi. `surface_water.debit_*_m3s` tetap m³/s.
- Debit di layar, templat, laporan: **L/s**. Tulisan satuan: `L/s` (templat: `L/S` pada judul kolom).
- Koagulan semua **kg**. 1 sak = 25 kg (`KG_PER_BAG` di `apps/web/src/lib/pdf/dates.ts`); sak hanya di PDF dan PPT, tidak berubah.
- No flow: `debit_outlet_m3s === 0`. Fungsi tunggal `isNoFlow` di shared dipakai di semua tempat.
- Impor hanya **Admin**, maksimal **1.000** baris, tanggal tidak boleh di masa depan, batas bawah 2000-01-01.
- Sel kosong, "no data", dan "no flow" (tanpa membedakan huruf) = tidak ada nilai; sel kosong tidak menimpa data yang ada.
- Teks pengguna berbahasa Indonesia. Pesan galat konsisten dengan gaya yang ada ("Tanggal harus ...").
- Penulisan batch ke D1 dipecah per 100 statement.

## Review Focus
- Pembulatan konversi: 0,123 m³/s ↔ 123 L/s harus bolak-balik tanpa ekor desimal (123.00000000000001).
- Angka berformat Indonesia di Excel ("0,0", "1,5", "1.234,5") dibaca benar; "1.234" tunggal dibaca 1,234 (didokumentasikan di Petunjuk); "no data" dan "No Flow" tidak jadi error.
- Hari no flow dengan pH 0: tidak merah di form, riwayat, laporan, grafik, dan beranda.
- Mengimpor berkas yang sama dua kali: hasil kedua semua "tidak berubah", tidak ada duplikat.
- Sel kosong pada baris yang sudah ada di aplikasi tidak menghapus nilai lama.
- Dua baris pada tanggal yang sama dengan curah hujan berbeda → error (cuaca per tanggal, bukan per pond).
- Sisa stok koagulan berantai berurutan tanggal walau baris di Excel tidak berurutan.
- Kode pond tidak dikenal atau pond nonaktif → error baris, bukan gagal seluruh berkas.
- Berkas lebih dari 1.000 baris ditolak dengan pesan jelas; tidak ada setengah tersimpan.

---

### Task 1: Satuan debit dan no flow di shared

**Files:**
- Modify: `packages/shared/src/math.ts`
- Test: `packages/shared/src/math.test.ts`

**Interfaces:**
- Produces: `m3sToLs(m3s: number): number`, `lsToM3s(ls: number): number`, `isNoFlow(debitOutlet: number | null | undefined): boolean` (true hanya bila tepat `0`). Dipakai Task 3, 4, 5, 6.

- [ ] **Step 1: Write the failing tests** di `math.test.ts`: `m3sToLs(0.25) === 250`; `lsToM3s(250) === 0.25`; `lsToM3s(m3sToLs(0.123)) === 0.123`; `m3sToLs(lsToM3s(123)) === 123`; `isNoFlow(0) === true`, `isNoFlow(null) === false`, `isNoFlow(undefined) === false`, `isNoFlow(0.0001) === false`.
- [ ] **Step 2: Run** `npm test --workspace packages/shared -- math`. Expected: FAIL (fungsi belum ada).
- [ ] **Step 3: Implement** ketiganya di `math.ts`. Konversi dibulatkan ke 6 desimal (`Math.round(x * 1e6) / 1e6`) setelah dikali/dibagi 1000.
- [ ] **Step 4: Run** perintah yang sama. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shared): satuan debit L/s dan penanda no flow`.

### Task 2: Parsing dan validasi baris impor harian (shared)

**Files:**
- Create: `packages/shared/src/daily-import.ts`
- Modify: `packages/shared/src/index.ts` (export)
- Test: `packages/shared/src/daily-import.test.ts`

**Interfaces:**
- Consumes: `parseDateCell`, `normalizeKey` (`import.ts`), `parseLocaleNumber` (`format.ts`), `lsToM3s` (Task 1).
- Produces:
  - `DAILY_IMPORT_MAX_ROWS = 1000`
  - `type DailyInputRow = { row: number; date: string | null; pond: string | null; rainfall: string | null; rain_hours: string | null; ph_inlet: string | null; ph_outlet: string | null; tss_inlet: string | null; tss_outlet: string | null; debit_inlet: string | null; debit_outlet: string | null; serbuk_in: string | null; serbuk_out: string | null; batu_in: string | null; batu_out: string | null; kapur_in: string | null; kapur_out: string | null }`
  - `type DailyRowOk = { ok: true; date: string; pond: string; weather: { rainfall_mm: number | null; rain_hours: number | null }; water: { ph_inlet: number | null; ph_outlet: number | null; tss_inlet: number | null; tss_outlet: number | null; debit_inlet_m3s: number | null; debit_outlet_m3s: number | null }; coagulant: Partial<Record<CoagulantType, { stock_in: number | null; stock_out: number | null }>> }`
  - `type DailyRowBad = { ok: false; error: string }`
  - `validateDailyRow(r: DailyInputRow, today: string): DailyRowOk | DailyRowBad`
  - `isBlankCell(raw: string | null): boolean` (kosong, "no data", "no flow", "-" → true)
  - `parseFlexibleNumber(raw: string): number | 'invalid'` — pembaca angka impor: bila ada titik dan koma, yang terakhir adalah desimal dan yang lain pemisah ribuan (`1.234,5` dan `1,234.5` → 1234.5); dua titik atau lebih → ribuan (`1.234.567` → 1234567); koma tunggal → desimal (`0,0`, `1,5`); titik tunggal → desimal (`1.234` → 1.234, sama dengan penyimpanan angka asli Excel); selain itu `'invalid'`

- [ ] **Step 1: Write the failing tests**: tanggal wajib ("Tanggal wajib diisi."), tanggal tak dikenali ("Tanggal tidak dikenali."), tanggal masa depan ("Tanggal tidak boleh di masa depan."), tanggal sebelum 2000 ditolak; pond wajib ("Pond wajib diisi."), pond dipangkas dan dikembalikan apa adanya (pencocokan kode dilakukan API); `"0,0"` → 0 dan `"1,5"` → 1.5; `"1.234,5"` dan `"1,234.5"` → 1234.5; `"1.234.567"` → 1234567; `"1.234"` → 1.234; `"1,2,3"` dan `"12a"` → error; `"no data"`, `"No Flow"`, `""`, `null` → `null` tanpa error; teks lain ("abc") → error "pH inlet harus berupa angka." (nama kolom di pesan); pH di luar 0 sampai 14 → error; nilai negatif → error; `rain_hours` > 24 → error; `debit_outlet "250"` → `debit_outlet_m3s === 0.25`; koagulan hanya muncul di `coagulant` bila setidaknya satu sel (masuk atau keluar) terisi.
- [ ] **Step 2: Run** `npm test --workspace packages/shared -- daily-import`. Expected: FAIL.
- [ ] **Step 3: Implement** `validateDailyRow` dengan rentang yang sama dengan rute PUT (pH 0..14, lainnya ≥ 0, jam hujan 0..24). Pesan galat memakai nama kolom Indonesia (`pH inlet`, `TSS outlet`, `Debit inlet`, `Curah hujan`, `Jam hujan`, `Tawas Serbuk masuk`, dst.).
- [ ] **Step 4: Run** perintah yang sama. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shared): validasi baris impor data harian`.

### Task 3: Kolom debit L/s dari API

**Files:**
- Modify: `apps/api/src/entries/day.ts` (`withDerivedFlow`), `apps/api/src/entries/dashboard.ts` (`today`)
- Test: `apps/api/test/entries.test.ts`, `apps/api/test/dashboard.test.ts`

**Interfaces:**
- Consumes: `m3sToLs` (Task 1).
- Produces: `withDerivedFlow` menambah `debit_inlet_ls`, `debit_outlet_ls` (number|null) selain field m³/s dan m³/d yang ada; dashboard `today.debit_outlet_ls`. Dipakai Task 5.

- [ ] **Step 1: Write the failing tests**: `GET /day` setelah menyimpan `debit_outlet_m3s: 0.25` mengembalikan `water.debit_outlet_ls === 250`; `GET /history` entri air membawa `debit_inlet_ls`; `GET /dashboard` `today.debit_outlet_ls === 250`; nilai null tetap null.
- [ ] **Step 2: Run** `npm test --workspace apps/api -- entries dashboard`. Expected: FAIL.
- [ ] **Step 3: Implement** di dua file; field lama tidak dihapus.
- [ ] **Step 4: Run** perintah yang sama. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): debit dalam L/s`.

### Task 4: Endpoint impor harian

**Files:**
- Create: `apps/api/src/entries/import.ts`
- Modify: `apps/api/src/index.ts` (`app.route('/entries', entryImportRoutes)`)
- Test: `apps/api/test/daily-import.test.ts`

**Interfaces:**
- Consumes: `validateDailyRow`, `DailyInputRow`, `DAILY_IMPORT_MAX_ROWS` (Task 2), `defaultRemaining`, `todayInSite`, `isNoFlow` tidak diperlukan; guard Admin seperti rute admin (`apps/api/src/auth/guard.ts`); `previousRemaining` (`coagulant.ts`).
- Produces: `POST /entries/import` body `{ rows: DailyInputRow[], dry?: boolean }` → `{ summary: { create, update, unchanged, error }, rows: { row; date; pond; status: 'create'|'update'|'unchanged'|'error'; message?: string; parts: ('cuaca'|'air'|'koagulan')[] }[] }`. Dipakai Task 8.

- [ ] **Step 1: Write the failing tests** (`daily-import.test.ts`, gaya `schedule-import.test.ts`):
  - Operator, Manager, Auditor → 403; 0 baris dan 1.001 baris → 400 "Berkas harus berisi 1 sampai 1000 baris."
  - `dry: true` mengembalikan hasil tanpa menulis (hitung baris tabel `weather`, `surface_water`, `coagulant` tetap 0).
  - Impor nyata: baris `SP11` 2026-04-01 dengan curah hujan, pH/TSS/debit "250", dan koagulan menulis satu baris `weather`, satu `surface_water` (`debit_outlet_m3s = 0.25`), dan baris `coagulant` per jenis terisi.
  - Impor berkas yang sama dua kali: pass kedua semua `unchanged`, jumlah baris tabel tidak bertambah.
  - Sel kosong tidak menimpa: baris ada dengan `ph_outlet = 7`, impor baris yang pH outlet-nya kosong → `ph_outlet` tetap 7, status `unchanged` atau `update` sesuai kolom lain.
  - Kode pond tidak dikenal dan pond nonaktif → `error` per baris, baris lain tetap tersimpan.
  - Dua baris tanggal sama dengan curah hujan berbeda → kedua baris `error` (pesan menyebut baris lain); curah hujan sama atau satu kosong → sah.
  - Baris ganda (tanggal + pond sama) → `error` "Baris ganda dengan baris N."
  - Sisa stok berantai: tiga baris SP11/Kapur tanggal 1, 2, 3 dikirim **tidak berurutan** → `stock_remaining` = kumulatif masuk − keluar menurut tanggal; stok sebelumnya di database (`previousRemaining`) dipakai sebagai awal.
  - Debit outlet "0" dengan pH "0" tersimpan apa adanya.
- [ ] **Step 2: Run** `npm test --workspace apps/api -- daily-import`. Expected: FAIL (404).
- [ ] **Step 3: Implement** `importHandler`: validasi tiap baris dengan `validateDailyRow`; cocokkan `pond` dengan `settling_ponds.code` (tanpa membedakan huruf) yang aktif; muat baris `weather`, `surface_water`, `coagulant` yang sudah ada untuk rentang tanggal dan pond di berkas; gabungkan nilai (null tidak menimpa); bandingkan dengan toleransi 1e-9 untuk `unchanged`; susun statement upsert memakai `COALESCE(excluded.x, x)` pada `ON CONFLICT DO UPDATE`; hitung `stock_remaining` berantai per (pond, jenis) berurutan tanggal; `logged_by` = admin; `client_ts` NULL; jalankan `db.batch` per 100 statement kecuali `dry`.
- [ ] **Step 4: Run** perintah yang sama. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): impor data harian dari Excel`.

### Task 5: Tampilan L/s di seluruh aplikasi

**Files:**
- Modify: `apps/web/src/screens/InputAir.tsx`, `apps/web/src/screens/Riwayat.tsx`, `apps/web/src/screens/BerandaOperator.tsx`, `apps/web/src/screens/BerandaManager.tsx`, `apps/web/src/screens/Laporan.tsx` (catatan), `apps/web/src/components/ReportCharts.tsx`, `apps/web/src/lib/report.ts`, `apps/web/src/lib/reportSeries.ts` (`WaterDay.debit_outlet_ls`), `apps/web/src/lib/pdf/pages.ts`, `apps/web/src/lib/pdf/slides.ts`, `apps/web/src/lib/pptx/slides.ts`, `apps/web/src/hooks/useDashboard.ts`, `apps/web/src/lib/report.ts` (`HistoryEntry.water.debit_*_ls`), tes-tes terkait.
- Test: `InputForms.test.tsx`, `Riwayat.test.tsx`, `report.test.ts`, `reportSeries.test.ts`, `pdf/pages.test.ts`, `BerandaOperator.test.tsx`, `BerandaManager.test.tsx`.

**Interfaces:**
- Consumes: `m3sToLs`, `lsToM3s` (Task 1); `debit_*_ls` dari API (Task 3).
- Produces: semua tempat yang tadinya `m³/d` atau `m³/s` untuk debit sekarang `L/s`. Form `InputAir` memegang `flow` dalam L/s dan mengonversi dengan `lsToM3s` saat menyimpan serta `m3sToLs` saat memuat; payload ke API tetap `debit_*_m3s`. Kolom "Debit harian (m³/d)" di form dihapus.

- [ ] **Step 1: Write the failing tests**: form air menampilkan label satuan `L/s`, menerima "250" dan mengirim `debit_outlet_m3s: 0.25`, memuat 0.25 sebagai "250"; Riwayat memakai header `Debit inlet (L/s)` / `Debit outlet (L/s)` dan menampilkan 250; `buildReport` kolom `di`/`do` berjudul `Debit inlet (L/s)` / `Debit outlet (L/s)` bernilai dari `debit_*_ls`; `waterByDate` mengisi `debit_outlet_ls`; kartu beranda memberi label `L/s`; catatan Laporan tidak lagi menyebut m³/s.
- [ ] **Step 2: Run** `npm test --workspace apps/web -- InputForms Riwayat report reportSeries pdf Beranda`. Expected: FAIL.
- [ ] **Step 3: Implement** perubahan di tiap berkas. Grafik debit outlet memakai satuan `L/s`, `decimals={1}`. Perbarui `HistoryEntry` dan `DayData` bila perlu.
- [ ] **Step 4: Run** perintah yang sama lalu `npx tsc --noEmit -p apps/web`. Expected: PASS, tanpa galat tipe.
- [ ] **Step 5: Commit** `feat(web): debit tampil dalam L/s`.

### Task 6: No flow di kepatuhan, riwayat, grafik, laporan

**Files:**
- Modify: `apps/web/src/ui/NumberInput.tsx` (atau pemakaian di `InputAir.tsx`), `apps/web/src/screens/InputAir.tsx`, `apps/web/src/screens/Riwayat.tsx`, `apps/web/src/screens/BerandaOperator.tsx`, `apps/web/src/screens/BerandaManager.tsx`, `apps/web/src/lib/report.ts`, `apps/web/src/components/TrendChart.tsx`, `apps/web/src/components/ReportCharts.tsx`, `apps/web/src/lib/reportSeries.ts`, `apps/web/src/lib/pdf/pages.ts`, `apps/web/src/lib/pdf/slides.ts`, `apps/web/src/lib/pptx/slides.ts`
- Test: file tes masing-masing.

**Interfaces:**
- Consumes: `isNoFlow` (Task 1), `debit_outlet_ls`/`debit_outlet_m3s`.
- Produces: `TrendPoint` mendapat `noFlow?: boolean`; `WaterDay` mendapat `noFlow: boolean` dan `noFlowDays` dihitung oleh `waterByDate`/ringkasan.

- [ ] **Step 1: Write the failing tests** (nama menyebut perilaku):
  - form air: debit outlet 0 dan pH outlet 0 → pH outlet **tidak** berpeta ke state merah (tidak ada tanda di luar baku mutu).
  - Riwayat: baris debit outlet 0 menampilkan `No flow` di sel pH outlet, TSS outlet, dan debit outlet, tanpa kelas `is-bad`; baris debit 0 dengan pH 0 tidak merah.
  - `buildReport`: baris air no flow → `bad` kosong, sel pH/TSS/debit outlet berisi teks `No flow`; ringkasan memuat jumlah hari no flow.
  - `waterByDate`: hari no flow → `noFlow: true`; ringkasan periode `noFlowDays` benar.
  - `TrendChart`: titik `noFlow` digambar di 0 dengan penanda khusus (`data-noflow` pada elemen titik) dan tidak diberi kelas `--bad`.
  - Beranda: pH outlet 0 pada hari debit 0 menampilkan lencana "No flow", bukan "Abnormal".
  - PDF/PPT pond page: seri air hari no flow bernilai 0 dan memuat catatan "N hari no flow" di ringkasan.
- [ ] **Step 2: Run** `npm test --workspace apps/web`. Expected: FAIL pada tes baru.
- [ ] **Step 3: Implement**: di setiap tempat yang memanggil `isOutOfLimit` untuk pH/TSS outlet, lewati bila `isNoFlow(debit)`; tampilkan label `No flow` di tabel riwayat dan laporan; kirim `noFlow` ke `TrendChart` (nilai 0 + penanda); tambahkan baris ringkasan jumlah hari no flow di kartu laporan, PDF, dan PPT.
- [ ] **Step 4: Run** `npm test --workspace apps/web` dan `npx tsc --noEmit -p apps/web`. Expected: seluruh suite hijau.
- [ ] **Step 5: Commit** `feat(web): hari no flow tidak dihitung pelanggaran dan tampil sebagai No flow`.

### Task 7: Templat dan pembaca berkas impor harian (web lib)

**Files:**
- Create: `apps/web/src/lib/dailyImport.ts`
- Test: `apps/web/src/lib/dailyImport.test.ts`

**Interfaces:**
- Consumes: `readXlsx`/`ReadSheet` (`xlsxRead.ts`), `buildSimpleXlsx` (`xlsx.ts`), `DailyInputRow`, `DAILY_IMPORT_MAX_ROWS`, `normalizeKey` (shared).
- Produces: `rowsToDaily(sheets: ReadSheet[]): DailyInputRow[]` (melempar `Error` berbahasa Indonesia), `buildDailyTemplate(): Uint8Array`. Dipakai Task 8.

- [ ] **Step 1: Write the failing tests**: templat berisi lembar `Data` (judul kolom persis sesuai spec: `Tanggal`, `Pond`, `Curah hujan (mm)`, `Jam hujan`, `pH inlet`, `pH outlet`, `TSS inlet`, `TSS outlet`, `Debit inlet (L/S)`, `Debit outlet (L/S)`, `Tawas Serbuk masuk (kg)`, `Tawas Serbuk keluar (kg)`, `Tawas Batu masuk (kg)`, `Tawas Batu keluar (kg)`, `Kapur masuk (kg)`, `Kapur keluar (kg)`) dan lembar `Petunjuk`; templat dibaca balik oleh `readXlsx` + `rowsToDaily` menjadi baris contoh; judul kolom dikenali tanpa membedakan huruf besar kecil dan spasi; kolom tambahan tak dikenal diabaikan; berkas tanpa kolom Tanggal dan Pond → Error "Kolom Tanggal dan Pond tidak ditemukan. Pakai templat."; baris kosong dilewati; nomor baris (`row`) = nomor baris Excel; lebih dari 1.000 baris → Error "Berkas harus berisi 1 sampai 1000 baris."
- [ ] **Step 2: Run** `npm test --workspace apps/web -- dailyImport`. Expected: FAIL.
- [ ] **Step 3: Implement** mengikuti `eventImport.ts` (cari baris judul di 5 baris pertama, lembar bernama `Data` atau lembar pertama). Lembar `Petunjuk` menjelaskan aturan: satuan, "No Flow"/"no data", sel kosong tidak menimpa, no flow = debit outlet 0, koagulan dalam kg, batas 1.000 baris, dan aturan angka (titik tunggal tiga angka dibaca desimal; isi angka ribuan sebagai angka biasa).
- [ ] **Step 4: Run** perintah yang sama. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): templat dan pembaca impor data harian`.

### Task 8: Layar Impor Data Harian

**Files:**
- Create: `apps/web/src/screens/ImporData.tsx`
- Modify: `apps/web/src/App.tsx` (rute `/input/impor`, Admin saja), `apps/web/src/screens/InputHub.tsx` (tautan "Impor Excel", hanya terlihat Admin)
- Test: `apps/web/src/screens/ImporData.test.tsx`, `apps/web/src/screens/InputHub.test.tsx`

**Interfaces:**
- Consumes: `rowsToDaily`, `buildDailyTemplate` (Task 7); `POST /entries/import` (Task 4); pola `ImporEvent.tsx`.
- Produces: layar dengan unduh templat, pilih berkas, pratinjau (ringkasan Baru/Diperbarui/Tidak berubah/Bermasalah + tabel per baris dengan kolom Baris, Tanggal, Pond, Bagian, Hasil, Keterangan), tombol "Impor".

- [ ] **Step 1: Write the failing tests** (gaya `ImporEvent.test.tsx`): templat diunduh dengan nama `impor-data-harian-templat.xlsx`; memilih berkas memanggil impor `dry` dan menampilkan ringkasan serta alasan baris bermasalah; tombol "Impor" mati bila tidak ada perubahan; konfirmasi mengirim tanpa `dry` lalu menampilkan toast "Impor selesai: N baru, M diperbarui"; berkas bukan xlsx menampilkan galat; rute ditolak untuk Operator/Manager; `InputHub` memperlihatkan tautan "Impor Excel" hanya untuk Admin.
- [ ] **Step 2: Run** `npm test --workspace apps/web -- ImporData InputHub`. Expected: FAIL.
- [ ] **Step 3: Implement** layar dan rute (`RequireRole allow={['Admin']}`).
- [ ] **Step 4: Run** perintah yang sama. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): layar impor data harian`.

### Task 9: Verifikasi akhir

**Files:** tidak ada perubahan kode kecuali perbaikan dari temuan.

- [ ] **Step 1:** `npm test --workspaces` (shared, API, web). Expected: seluruhnya hijau; catat jumlah tes.
- [ ] **Step 2:** `npx tsc --noEmit -p apps/web` dan `npx tsc --noEmit -p apps/api`. Expected: bersih.
- [ ] **Step 3:** `npm run build --workspace apps/web`. Expected: sukses.
- [ ] **Step 4:** Review seluruh cabang terhadap spec dan bagian Review Focus; setiap temuan penting diperbaiki dengan tes yang gagal dulu.
- [ ] **Step 5:** Laporkan hasil; deploy hanya setelah diminta (tidak ada migrasi).
