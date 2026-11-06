# Kalender Enviro: Kategori, Titik per Kategori, Impor Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the user runs plans inline, never subagent-driven). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Event enviro punya kategori (master berwarna), kalender menampilkan titik per kategori melingkar di angka tanggal, dan event setahun bisa diimpor dari Excel.

**Architecture:** Tabel `event_categories` baru dan kolom `event_schedules.category_id`. Validasi baris impor ada di `packages/shared` supaya klien (pratinjau) dan server (penyimpanan) memakai aturan yang sama; server tetap otoritatif lewat `POST /schedules/import` dengan mode `dry`. Berkas `.xlsx` dibaca di browser dengan `fflate`, lalu dikirim sebagai JSON.

**Tech Stack:** Hono + D1 (apps/api), React + Vite + vitest (apps/web), `fflate` (sudah ada), `@evo/shared`.

**Spec:** `docs/superpowers/specs/2026-11-06-kalender-kategori-impor-design.md`

## Global Constraints

- Bahasa antarmuka dan pesan galat: Indonesia. Pesan galat API berbentuk `{ error: string }`.
- Peran: kelola kategori dan impor hanya `Manager` dan `Admin` (middleware `requireScheduler`); membaca kategori boleh semua pengguna yang masuk.
- Palet 16 warna tetap; kategori otomatis dari impor mengambil warna palet pertama yang belum dipakai kategori aktif, mengulang dari awal bila habis.
- Titik kalender: satu titik per kategori per hari, maksimal 8 tampil (jika lebih: 7 titik + 1 titik "+"). Tanpa kategori = abu-abu `#9AA39A`, diurutkan terakhir.
- Status overdue, menunggu, selesai tidak tampil di grid kalender (hanya di daftar samping, seperti sekarang).
- Event tidak memakai pond: `sp_id` tidak lagi diterima, dikembalikan, atau ditampilkan; kolom DB `event_schedules.sp_id` tetap ada dan tidak diubah.
- Impor: maksimal 500 baris, hanya `.xlsx`, tanpa dependensi baru. Judul maksimal 120 karakter. Batas tanggal mulai: 1 Jan 2000 sampai 5 tahun dari hari ini (aturan `startDateOk` yang sudah ada).
- Pencocokan baris impor: judul + kategori, tanpa membedakan huruf besar kecil, spasi di tepi dibuang, spasi ganda diringkas jadi satu.
- Event yang sudah punya catatan selesai atau eviden terkunci: frekuensi dan tanggal mulai tidak boleh berubah (aturan yang sudah ada).
- Commit per task. Akhiri pesan commit dengan `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hanya `git add` berkas milik task (working tree berisi perubahan lain milik pengguna yang tidak boleh ikut).

## Review Focus

- Sel tanggal Excel: seri angka (`46328` = 2026-11-02), teks `02/11/2026`, teks `2026-11-02`, dan sel kosong atau teks asal-asalan harus menghasilkan tanggal yang benar atau galat baris yang jelas, bukan tanggal salah diam-diam. (Task 1, 5)
- Nama kategori beda huruf besar atau spasi (`Air  Limbah`, `air limbah`) harus menjadi satu kategori, bukan dua. (Task 2, 4)
- Mengimpor berkas yang sama dua kali tidak membuat duplikat dan melaporkan "tidak berubah". (Task 4)
- Dua baris dalam satu berkas yang cocok dengan event yang sama: baris kedua ditolak, bukan saling menimpa. (Task 4)
- Berkas bukan `.xlsx`, tanpa header yang dikenali, atau lebih dari 500 baris: pesan jelas, tidak ada yang tersimpan. (Task 4, 5, 8)
- Hari dengan lebih dari 8 kategori dan hari dengan event tanpa kategori tetap terbaca di grid dan di label aksesibilitas. (Task 6)

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `packages/shared/src/categories.ts` (baru) | palet, `NO_CATEGORY_COLOR`, `nextPaletteColor` |
| `packages/shared/src/import.ts` (baru) | tipe baris impor, `normalizeKey`, `parseDateCell`, `parseFrequencyCell`, `validateImportRow`, `startDateInRange` |
| `packages/shared/src/events.ts` | `EventOccurrence` ganti `sp_id` dengan field kategori |
| `apps/api/migrations/0007_event_categories.sql` (baru) | tabel kategori + `category_id` |
| `apps/api/src/events/categories.ts` (baru) | rute `/event-categories` |
| `apps/api/src/events/import.ts` (baru) | logika `POST /schedules/import` (dipasang dari `schedules.ts`) |
| `apps/api/src/events/schedules.ts`, `events.ts` | kategori, tanpa pond |
| `apps/web/src/lib/xlsxRead.ts` (baru) | pembaca `.xlsx` generik → baris sel teks |
| `apps/web/src/lib/eventImport.ts` (baru) | baris sel → `ImportInputRow[]`, templat `.xlsx` |
| `apps/web/src/lib/marks.ts`, `components/MonthGrid.tsx`, `EventCard.tsx` | titik kategori melingkar, legenda, label kategori |
| `apps/web/src/screens/KategoriEvent.tsx` (baru) | master kategori |
| `apps/web/src/screens/ImporEvent.tsx` (baru) | layar impor |
| `apps/web/src/screens/AturJadwal.tsx`, `App.tsx`, `EventDetail.tsx`, `lib/report.ts` | kategori menggantikan pond, rute baru |

---

### Task 1: Shared — palet, parsing sel, validasi baris

**Files:**
- Create: `packages/shared/src/categories.ts`, `packages/shared/src/import.ts`
- Create test: `packages/shared/src/categories.test.ts`, `packages/shared/src/import.test.ts`
- Modify: `packages/shared/src/index.ts` (export keduanya), `packages/shared/src/events.ts` (`EventOccurrence`)

**Interfaces:**
- Produces (`categories.ts`): `CATEGORY_PALETTE: readonly string[]` (16 nilai `#RRGGBB` unik), `NO_CATEGORY_COLOR = '#9AA39A'`, `nextPaletteColor(used: string[]): string`.
- Produces (`import.ts`):
  - `type ImportInputRow = { row: number; category: string | null; title: string; frequency: string | null; start: string | null }` (semua sel sudah berupa teks; `row` = nomor baris Excel).
  - `normalizeKey(s: string): string` — trim, ringkas spasi, huruf kecil.
  - `parseDateCell(raw: string): string | null` — terima `YYYY-MM-DD`, `DD/MM/YYYY`, `D/M/YYYY`, dan seri Excel berupa string angka (hari sejak 1899-12-30; hanya rentang 36526..73050); kembalikan ISO yang valid atau `null`.
  - `parseFrequencyCell(raw: string): { kind: 'frequency'; frequency: EventFrequency } | { kind: 'date'; date: string } | null` — nama Indonesia (`FREQUENCY_LABEL`) atau Inggris (`EVENT_FREQUENCIES`) tanpa membedakan huruf besar kecil; kalau bukan nama frekuensi, coba `parseDateCell`.
  - `startDateInRange(date: string, today: string): boolean` — `date >= '2000-01-01'` dan `date <= (tahun hari ini + 5) + bagian -MM-DD hari ini`.
  - `validateImportRow(r: ImportInputRow, today: string): { ok: true; title: string; category: string | null; frequency: EventFrequency; start_date: string } | { ok: false; error: string }`.
- `EventOccurrence`: hapus `sp_id`; tambah `category_id: string | null`, `category_name: string | null`, `category_color: string | null`.

- [ ] **Step 1: Tulis tes `categories.test.ts`**: palet berisi 16 warna unik berformat `#RRGGBB`; `nextPaletteColor([])` = `CATEGORY_PALETTE[0]`; `nextPaletteColor([P[0], P[1]])` = `P[2]`; ketika ke-16 warna terpakai, mengembalikan warna yang paling sedikit dipakai (yang pertama bila seri), jadi `nextPaletteColor(CATEGORY_PALETTE)` = `P[0]`.
- [ ] **Step 2: Tulis tes `import.test.ts`** dengan nilai persis: `parseDateCell('46328')` = `'2026-11-02'`; `parseDateCell('02/11/2026')` = `'2026-11-02'`; `parseDateCell('2/11/2026')` = `'2026-11-02'`; `parseDateCell('2026-11-02')` = `'2026-11-02'`; `parseDateCell('31/02/2026')`, `'abc'`, `''`, `'5'` (di luar rentang seri) = `null`. `parseFrequencyCell('harian')` = `{kind:'frequency', frequency:'Daily'}`; `'3-Bulanan'` → `Quarterly`; `'semi-annual'` → `Semi-Annual`; `'15/01/2027'` → `{kind:'date', date:'2027-01-15'}`; `'sering'` → `null`. `normalizeKey('  Air   Limbah ')` = `'air limbah'`. `validateImportRow` dengan `today='2026-11-06'`: frekuensi kata + `start` valid → ok dengan `start_date`; frekuensi berupa tanggal → `frequency:'Annual'`, `start_date` = tanggal itu, kolom `start` diabaikan; frekuensi kata tanpa `start` → `{ok:false, error:'Tanggal mulai wajib diisi untuk frekuensi berulang.'}`; judul kosong → `'Judul wajib diisi.'`; judul 121 karakter → `'Judul maksimal 120 karakter.'`; frekuensi kosong → `'Frekuensi atau tanggal wajib diisi.'`; frekuensi tak dikenal → `'Frekuensi tidak dikenal. Isi Harian, Mingguan, Bulanan, 3-Bulanan, 6-Bulanan, Tahunan, atau sebuah tanggal.'`; tanggal di luar batas (`'1999-12-31'`, `'2032-01-01'`) → `'Tanggal harus antara 1 Jan 2000 dan 5 tahun dari sekarang.'`.
- [ ] **Step 3: Jalankan** `npm test -w packages/shared` — Expected: FAIL (modul belum ada).
- [ ] **Step 4: Implementasikan** kedua modul dengan tanda tangan di atas. Seri Excel → ISO: `new Date(Date.UTC(1899, 11, 30) + n * 86_400_000)`. Validasi `DD/MM/YYYY` dengan membangun tanggal lalu membandingkan balik hasilnya (menolak `31/02`). Ekspor di `index.ts`; ubah `EventOccurrence` dan hapus `sp_id` dari tipe.
- [ ] **Step 5: Jalankan** `npm test -w packages/shared` — Expected: PASS. (`tsc` aplikasi akan gagal sampai Task 3; itu wajar, jangan dijalankan di sini.)
- [ ] **Step 6: Commit** `feat(shared): palet kategori dan validasi baris impor event`.

---

### Task 2: Migrasi dan API master kategori

**Files:**
- Create: `apps/api/migrations/0007_event_categories.sql`, `apps/api/src/events/categories.ts`
- Create test: `apps/api/test/categories.test.ts`
- Modify: `apps/api/src/index.ts` (`app.route('/event-categories', categoryRoutes)`), `apps/api/test/setup.ts` (tambahkan `'event_categories'` ke daftar tabel yang dibersihkan, **setelah** `'event_schedules'`)

**Interfaces:**
- Produces (SQL): `event_categories(id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`, indeks unik `CREATE UNIQUE INDEX idx_event_categories_name ON event_categories(lower(name))`; `ALTER TABLE event_schedules ADD COLUMN category_id TEXT REFERENCES event_categories(id)`.
- Produces (API):
  - `GET /event-categories` → `{ id, name, color, is_active: boolean, event_count: number }[]` (urut nama; `event_count` = jumlah jadwal aktif, `ended_on IS NULL`, berkategori itu).
  - `POST /event-categories` body `{ name, color }` → 201 `{ id }`.
  - `PATCH /event-categories/:id` body sebagian dari `{ name, color, is_active }` → `{ id }`.
  - Galat: nama kosong atau >60 karakter → 400 `'Nama kategori wajib diisi, maksimal 60 karakter.'`; warna di luar `CATEGORY_PALETTE` → 400 `'Pilih warna dari palet.'`; nama kembar (tanpa beda huruf) → 409 `'Nama kategori sudah dipakai.'`; id tak ada → 404 `'Kategori tidak ditemukan.'`; peran bukan Manager/Admin pada tulis → 403 (pesan `requireScheduler`).
- Export dari `categories.ts` untuk Task 4: `readCategoryName(raw: unknown): string | null` (trim, ringkas spasi ganda).

- [ ] **Step 1: Tulis `categories.test.ts`** memakai `login`/`call`/`json` dari `helpers.ts`: Manager dan Admin bisa `POST` (201); Operator dan Auditor 403 pada `POST` dan `PATCH` tetapi 200 pada `GET`; `POST` nama `'Air Limbah'` lalu `'air  limbah'` → 409; warna `'#123456'` → 400; `PATCH` `{is_active:false}` lalu `GET` mengembalikan `is_active:false`; `event_count` menghitung hanya jadwal aktif (sisipkan dua `event_schedules`, satu `ended_on` terisi → count 1).
- [ ] **Step 2: Jalankan** `npm test -w apps/api -- categories` — Expected: FAIL.
- [ ] **Step 3: Tulis migrasi `0007` dan `categories.ts`**: pola rute mengikuti `schedules.ts` (`requireAuth` untuk semua, `requireScheduler` untuk `POST`/`PATCH`). Simpan nama dengan ringkasan spasi; unik lewat indeks `lower(name)` dan tangkap galat constraint menjadi 409.
- [ ] **Step 4: Jalankan** `npm test -w apps/api -- categories` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): master kategori event`.

---

### Task 3: API jadwal dan event: kategori menggantikan pond

**Files:**
- Modify: `apps/api/src/events/schedules.ts`, `apps/api/src/events/events.ts`, `apps/web/src/screens/EventDetail.tsx` (tampilkan kategori, bukan pond), `apps/web/src/components/EventCard.tsx` (hapus `pondName`, tampilkan nama kategori di `meta`), `apps/web/src/screens/Kalender.tsx` (hapus `pondName`), `apps/web/src/lib/report.ts` (kolom `place`/`Lokasi` pada bagian event → `category`/`Kategori`, isi `e.category_name ?? 'Tanpa kategori'`)
- Modify tests: `apps/api/test/schedules.test.ts`, `apps/api/test/events.test.ts` (hapus kasus pond/`sp` dan ganti dengan kasus kategori), tes web yang menyebut lokasi event (`lib/report.test.ts`, `screens/EventDetail.test.tsx`, `screens/Kalender.test.tsx`, `screens/AturJadwal.test.tsx` bagian tampilan baris)

**Interfaces:**
- Consumes: `event_categories`, `category_id` (Task 2), `EventOccurrence` baru (Task 1).
- Produces: `POST`/`PATCH /schedules` menerima `category_id` (string atau kosong/null; id tak ada → 404 `'Kategori tidak ditemukan.'`) dan **mengabaikan** `sp_id`. `GET /schedules` dan tiap kemunculan event membawa `category_id`, `category_name`, `category_color` (null bila tanpa kategori); `sp_id` tidak lagi ada di keluaran. `?sp=` pada `/events*` diabaikan (filter `sp` dihapus dari `readFilters`/`loadSchedules`). Kategori nonaktif tetap boleh dipilih untuk event yang sudah memakainya, tetapi `POST`/`PATCH` yang **mengganti** ke kategori nonaktif → 400 `'Kategori ini nonaktif.'`.

- [ ] **Step 1: Tulis tes API (gagal dulu)** di `schedules.test.ts`: buat kategori lewat SQL, `POST /schedules` dengan `category_id` → `GET /schedules` mengembalikan `category_id`, `category_name`, `category_color`; `category_id: 'nope'` → 404; kategori nonaktif pada jadwal baru → 400; `PATCH` dengan `sp_id` tidak mengubah apa pun dan keluaran tidak punya `sp_id`; `PATCH {category_id: null}` mengosongkan. Di `events.test.ts`: kemunculan membawa `category_color`; event tanpa kategori mengembalikan tiga field `null`; `?sp=<id>` tidak lagi menyaring.
- [ ] **Step 2: Jalankan** `npm test -w apps/api` — Expected: FAIL pada kasus baru.
- [ ] **Step 3: Implementasikan.** `schedules.ts`: ganti `sp_id` di `SELECT`/`readFields`/`checkRefs`/`INSERT`/`UPDATE` dengan `category_id` (JOIN `event_categories` untuk `category_name`, `category_color`). `events.ts`: tambah JOIN di `BASE`, tambah tiga field ke `occurrence()`, hapus filter dan field `sp_id`. Pada tes yang memakai `sp_id` di `INSERT` langsung ke tabel, kolom itu masih ada sehingga tidak perlu diubah.
- [ ] **Step 4: Perbaiki konsumen web** (`EventDetail`, `EventCard`, `Kalender`, `report.ts`) sampai `npx tsc --noEmit -p apps/web` bersih, lalu perbarui tes web yang gagal. Tampilan `AturJadwal` (daftar dan form) dikerjakan di Task 7; di sini cukup agar tipe `Schedule` lokalnya tidak lagi membaca `sp_id` dari event.
- [ ] **Step 5: Jalankan** `npm test -w apps/api` dan `npm test -w apps/web` — Expected: PASS semua.
- [ ] **Step 6: Commit** `feat: event berkategori, tanpa pond`.

---

### Task 4: API impor jadwal

**Files:**
- Create: `apps/api/src/events/import.ts`
- Create test: `apps/api/test/schedule-import.test.ts`
- Modify: `apps/api/src/events/schedules.ts` (pasang `scheduleRoutes.post('/import', requireScheduler, importHandler)` **sebelum** rute `/:id/...`)

**Interfaces:**
- Consumes: `ImportInputRow`, `validateImportRow`, `normalizeKey`, `nextPaletteColor` (Task 1); `readCategoryName` (Task 2).
- Produces: `POST /schedules/import` body `{ rows: ImportInputRow[]; dry?: boolean }` → `{ summary: { create: number; update: number; unchanged: number; skipped: number; error: number; newCategories: string[] }; rows: { row: number; title: string; category: string | null; status: 'create' | 'update' | 'unchanged' | 'skipped' | 'error'; message?: string; newCategory?: boolean }[] }`.
- Aturan per baris, berurutan: (1) `validateImportRow` gagal → `error` dengan pesannya. (2) kunci `normalizeKey(title) + '|' + normalizeKey(category ?? '')` sudah muncul di baris sebelumnya → `error` `'Baris ganda dengan baris N.'`. (3) cari jadwal aktif (`ended_on IS NULL`) dengan kunci sama: tidak ada → `create`; ada dan frekuensi + `start_date` sama → `unchanged`; ada dan berbeda dan `locked` → `skipped` `'Sudah punya catatan, frekuensi dan tanggal mulai tidak bisa diubah.'`; ada dan berbeda → `update`. Kategori dicocokkan ke `event_categories` lewat `normalizeKey(name)` (termasuk yang nonaktif); tidak ada → dibuat (`newCategory: true`) dengan warna `nextPaletteColor(warna kategori aktif)`; satu nama baru hanya dibuat sekali walau muncul di banyak baris.
- `rows` kosong atau lebih dari 500 → 400 `'Berkas harus berisi 1 sampai 500 baris.'`. Mode `dry: true` tidak menulis apa pun. Penyimpanan memakai `db.batch` (kategori baru dulu, lalu insert/update jadwal); baris `error`/`skipped`/`unchanged` tidak ditulis. `created_by` = pengguna yang mengimpor.

- [ ] **Step 1: Tulis `schedule-import.test.ts`** (Manager, `today` dari `todayInSite()`): baris baru + kategori baru → `dry:true` mengembalikan `status:'create'`, `newCategory:true` dan **tidak** ada baris di `event_schedules`/`event_categories`; tanpa `dry` tersimpan, kategori berwarna `CATEGORY_PALETTE[0]`; impor ulang berkas yang sama → semua `unchanged`, jumlah baris tabel tetap; `'Air Limbah'` dan `'air  limbah'` pada dua baris berbeda judul → satu kategori saja; dua baris dengan judul+kategori sama → baris kedua `error` `'Baris ganda dengan baris 2.'` (baris pertama bernomor 2); baris dengan frekuensi tanggal (`'15/01/2027'` dikirim sebagai teks) → tersimpan `Annual` dengan `start_date` `2027-01-15`; mengubah `Monthly`→`Weekly` pada jadwal tanpa catatan → `update` dan tersimpan; pada jadwal yang punya `event_completions` → `skipped` dan tidak berubah; jadwal berhenti (`ended_on` terisi) dengan judul sama tidak dianggap cocok (dibuat baru); 501 baris → 400; `rows: []` → 400; Operator → 403; baris campur sah dan tidak sah: yang sah tetap tersimpan, yang tidak sah dilaporkan.
- [ ] **Step 2: Jalankan** `npm test -w apps/api -- schedule-import` — Expected: FAIL.
- [ ] **Step 3: Implementasikan `importHandler`** sesuai aturan di atas. Muat semua kategori dan semua jadwal aktif (dengan flag `locked` memakai `EXISTS` yang sama seperti `SELECT` di `schedules.ts`; ekspor kembali ekspresi itu agar tidak diduplikasi) sekali, lalu proses baris di memori.
- [ ] **Step 4: Jalankan** `npm test -w apps/api` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): impor jadwal event dari baris Excel`.

---

### Task 5: Web — pembaca xlsx dan templat impor

**Files:**
- Create: `apps/web/src/lib/xlsxRead.ts`, `apps/web/src/lib/eventImport.ts`
- Create test: `apps/web/src/lib/xlsxRead.test.ts`, `apps/web/src/lib/eventImport.test.ts`

**Interfaces:**
- Produces (`xlsxRead.ts`): `readXlsx(bytes: Uint8Array): { sheets: { name: string; rows: string[][] }[] }`. Sel teks dibaca dari `sharedStrings` dan `inlineStr`; sel angka dikembalikan sebagai string angkanya (seri tanggal tidak diubah di sini); sel kosong = `''`; baris dipadatkan ke indeks kolom dari referensi sel (`C5` → kolom 2). Berkas yang bukan zip atau tanpa `xl/workbook.xml` → lempar `Error('Berkas bukan .xlsx yang valid.')`.
- Produces (`eventImport.ts`):
  - `rowsToImport(sheets: {name: string; rows: string[][]}[]): ImportInputRow[]` — pakai lembar bernama `Event` (tanpa beda huruf besar kecil) atau lembar pertama; cari baris header (maksimal 5 baris pertama) dengan kolom yang dikenali lewat `normalizeKey`: `kategori`; `event` atau `outstanding`; `frekuensi atau due date`, `frekuensi`, atau `due date`; `tanggal mulai`. Kolom `event` dan frekuensi wajib; tanpa itu lempar `Error('Kolom Event dan Frekuensi atau due date tidak ditemukan. Pakai templat.')`. Baris data setelah header; baris yang semua selnya kosong dilewati; `row` = nomor baris Excel (mulai 1). Lebih dari 500 baris data → `Error('Berkas harus berisi 1 sampai 500 baris.')`.
  - `buildImportTemplate(): Uint8Array` — `.xlsx` dengan lembar `Event` (header `Kategori`, `Event`, `Frekuensi atau due date`, `Tanggal mulai` + 3 baris contoh: satu berulang `Bulanan` dengan tanggal mulai, satu `Tahunan` dengan tanggal, satu berisi tanggal di kolom frekuensi) dan lembar `Petunjuk`. Pakai ulang `xmlEscape` dari `lib/xlsx.ts`; bangun paketnya dengan pola `buildXlsx` (boleh mengekspor helper kecil dari `xlsx.ts` bila perlu, tanpa mengubah perilaku `buildXlsx`).

- [ ] **Step 1: Tulis `xlsxRead.test.ts`**: bulatkan perjalanan `buildImportTemplate()` → `readXlsx` mengembalikan header yang sama dan 3 baris contoh; berkas yang dibuat tangan dengan `zipSync` berisi `sharedStrings` + sel angka `46328` + sel kosong di tengah (`A1`, `C1`) memberi `['teks','','46328']`; byte acak → lempar `'Berkas bukan .xlsx yang valid.'`.
- [ ] **Step 2: Tulis `eventImport.test.ts`**: header berurutan berbeda (`Event, Kategori, Frekuensi`) tetap terpetakan; header memakai huruf besar dan spasi tepi (`' EVENT '`) terpetakan; baris kosong di tengah dilewati dan `row` tetap sesuai nomor Excel; tanpa kolom `Event` → lempar pesan di atas; 501 baris data → lempar; lembar `Event` dipilih walau bukan lembar pertama.
- [ ] **Step 3: Jalankan** `npm test -w apps/web -- xlsxRead eventImport` — Expected: FAIL.
- [ ] **Step 4: Implementasikan** kedua modul. Parser XML: pakai `DOMParser` (tersedia di jsdom dan browser), bukan regex.
- [ ] **Step 5: Jalankan** tes yang sama — Expected: PASS.
- [ ] **Step 6: Commit** `feat(web): pembaca xlsx dan templat impor event`.

---

### Task 6: Web — titik kategori melingkar, legenda, label kategori

**Files:**
- Modify: `apps/web/src/lib/marks.ts` (+ `marks.test.ts`), `apps/web/src/components/MonthGrid.tsx` (+ `MonthGrid.test.tsx`), `apps/web/src/components/CalendarOverview.tsx`, `apps/web/src/screens/Kalender.tsx` (+ `Kalender.test.tsx`), `apps/web/src/components/EventCard.tsx` (label kategori berwarna), `apps/web/src/styles/ui.css`

**Interfaces:**
- Produces (`marks.ts`): `type DayMark = { key: string; name: string; color: string }` (`key` = `category_id` atau `'none'`; nama `'Tanpa kategori'`, warna `NO_CATEGORY_COLOR` bila kosong); `marksOf(events: EventOccurrence[]): Record<string, DayMark[]>` — tiap kategori sekali per hari, diurutkan nama menurut `localeCompare('id')`, `'none'` terakhir. Hapus `DayStatus`, `DAY_STATUS_*`.
- `MonthGrid` props: `marks: Record<string, DayMark[]>` (sisanya tetap). Grid: `data-marks` = `key` dipisah spasi; label tombol = `"{tanggal} {bulan}, {nama1}, {nama2}"` (tanpa daftar kata status); dalam `.ui-mday` tambahkan `<span class="ui-ring" aria-hidden="true">` berisi satu `<i class="ui-dot" style="--bg:{color};--a:{derajat}deg">` per titik. Susunan: n titik tersebar rata dimulai dari atas (−90°) searah jarum jam; n > 8 → 7 titik pertama + satu `<i class="ui-dot is-more">`. Legenda `ul.ui-legend.ui-month__legend[aria-label="Kategori"]` berisi kategori yang muncul di bulan itu (urutan sama), diturunkan dari `marks` tanpa prop tambahan.
- CSS: `.ui-mday { position: relative }`, `.ui-ring { position:absolute; left:50%; top:15px; width:0; height:0 }`, `.ui-ring .ui-dot { position:absolute; width:6px; height:6px; margin:-3px 0 0 -3px; background:var(--bg); transform: rotate(var(--a)) translateY(-19px) }` (cincin berjari-jari 19px di sekitar angka 30px; pastikan tidak terpotong pada kolom selebar 43px); `.is-more` berupa cincin kosong abu-abu; hapus aturan `.ui-dot.is-overdue/is-pending/is-done`.

- [ ] **Step 1: Tulis ulang `marks.test.ts`**: dua event satu kategori pada hari sama → satu `DayMark`; dua kategori diurutkan nama; event tanpa kategori → `{key:'none', name:'Tanpa kategori', color:'#9AA39A'}` terakhir; hari tanpa event tak punya entri.
- [ ] **Step 2: Tulis ulang kasus titik di `MonthGrid.test.tsx`**: 3 kategori pada `2026-11-03` → tiga elemen `.ui-dot` dengan `--bg` sesuai warna dan sudut `-90deg`, `30deg`, `150deg`; label `'3 November, Air, Udara, Tanpa kategori'` (nama contoh); 9 kategori → 7 `.ui-dot:not(.is-more)` + 1 `.is-more`, dan label tetap menyebut semua 9 nama; legenda menampilkan hanya kategori bulan itu; tanpa event → tidak ada `data-marks` dan tidak ada `.ui-ring`; tidak ada lagi teks "Overdue/Menunggu/Selesai" di legenda. Perbarui `Kalender.test.tsx` (kasus `data-marks`) mengikuti bentuk baru.
- [ ] **Step 3: Jalankan** `npm test -w apps/web -- marks MonthGrid Kalender` — Expected: FAIL.
- [ ] **Step 4: Implementasikan** `marks.ts`, `MonthGrid.tsx`, CSS, label kategori di `EventCard` (chip kecil dengan bulatan warna + nama; tanpa kategori = tidak ada chip), dan sesuaikan `CalendarOverview`/`Kalender` ke tipe baru.
- [ ] **Step 5: Jalankan** `npm test -w apps/web` dan `npx tsc --noEmit -p apps/web` — Expected: PASS dan tanpa galat.
- [ ] **Step 6: Commit** `feat(web): titik kalender per kategori melingkar`.

---

### Task 7: Web — layar kategori dan form jadwal berkategori

**Files:**
- Create: `apps/web/src/screens/KategoriEvent.tsx`, `apps/web/src/screens/KategoriEvent.test.tsx`
- Modify: `apps/web/src/screens/AturJadwal.tsx` (+ `AturJadwal.test.tsx`), `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `GET/POST/PATCH /event-categories` (Task 2), `CATEGORY_PALETTE` (Task 1), `api`/`post`/`patch` dari `api/client`.
- Produces: rute `/kalender/kategori` (`RequireRole allow ['Manager','Admin']`) → `<KategoriEvent />`. `AturJadwal`: hapus pemilih pond dan pemakaian `usePond`/`/ponds`; tambah `<select aria-label="Kategori">` (opsi "Tanpa kategori" + kategori aktif; bila jadwal yang diubah memakai kategori nonaktif, opsinya ikut tampil berlabel "(nonaktif)"); `Form.sp_id` diganti `category_id`; baris daftar menampilkan `FREQUENCY_LABEL - {nama kategori ?? 'Tanpa kategori'} - mulai {tanggal}`; dua tombol di atas daftar: "Kategori" (tautan ke `/kalender/kategori`) dan "Impor Excel" (tautan ke `/kalender/jadwal/impor`, rute dibuat di Task 8).
- `KategoriEvent`: kartu per kategori (bulatan warna, nama, `event_count`, status), tombol ubah (nama + pemilih 16 warna `button[aria-label="Warna {hex}"]` dengan `aria-pressed`), tombol Nonaktifkan/Aktifkan, tombol "Tambah kategori" (warna awal = `nextPaletteColor` dari kategori aktif).

- [ ] **Step 1: Tulis `KategoriEvent.test.tsx`** (pola `mockApi` + `renderApp`, peran Manager): daftar tampil dengan nama dan jumlah event; tambah kategori `POST /api/event-categories` `{name:'Air', color:<palet pertama yang belum terpakai>}`; mengganti warna lewat tombol `Warna #…` lalu simpan → `PATCH` dengan warna itu; 409 dari server tampil sebagai pesan `'Nama kategori sudah dipakai.'`; Operator dialihkan keluar (tidak ada layar).
- [ ] **Step 2: Ubah `AturJadwal.test.tsx`**: tidak ada lagi `combobox` Settling Pond; form mengirim `category_id` dan tidak mengirim `sp_id`; baris daftar menampilkan nama kategori; kategori nonaktif pada jadwal lama tetap tampil di pilihan.
- [ ] **Step 3: Jalankan** `npm test -w apps/web -- KategoriEvent AturJadwal` — Expected: FAIL.
- [ ] **Step 4: Implementasikan** layar, perubahan form, dan rute di `App.tsx`.
- [ ] **Step 5: Jalankan** `npm test -w apps/web` dan `npx tsc --noEmit -p apps/web` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(web): master kategori event dan form jadwal berkategori`.

---

### Task 8: Web — layar impor Excel

**Files:**
- Create: `apps/web/src/screens/ImporEvent.tsx`, `apps/web/src/screens/ImporEvent.test.tsx`
- Modify: `apps/web/src/App.tsx` (rute `/kalender/jadwal/impor`, `allow ['Manager','Admin']`)

**Interfaces:**
- Consumes: `readXlsx` (Task 5), `rowsToImport`, `buildImportTemplate` (Task 5), `POST /schedules/import` (Task 4), `saveBlob` dari `lib/download`.
- Produces: alur satu layar: tombol "Unduh templat" (`saveBlob` `impor-event-templat.xlsx`); `<input type="file" accept=".xlsx">`; setelah dipilih: baca → `POST` dengan `dry:true` → tampilkan ringkasan (`Baru N`, `Diperbarui N`, `Tidak berubah N`, `Dilewati N`, `Bermasalah N`, daftar kategori baru) dan tabel per baris (nomor, judul, kategori, status, pesan; kategori baru diberi badge "Baru"); tombol "Impor" aktif hanya bila `create + update > 0`, mengirim ulang tanpa `dry`; hasil akhir `toast('Impor selesai: N baru, M diperbarui')` dan tautan kembali ke Atur Jadwal. Galat baca atau 400 tampil sebagai `ui-error` `role="alert"` dan tidak mengirim apa pun. Memilih berkas lain mengganti pratinjau.

- [ ] **Step 1: Tulis `ImporEvent.test.tsx`**: dengan `buildImportTemplate()` sebagai berkas, memilih berkas memicu satu `POST /api/schedules/import` berbody `dry:true` dan berisi 3 baris; pratinjau menampilkan ringkasan dari balasan tiruan; klik "Impor" memicu `POST` kedua tanpa `dry`; berkas teks biasa (`new File(['x'], 'a.xlsx')`) → alert `'Berkas bukan .xlsx yang valid.'` dan tidak ada `POST`; ketika `create + update = 0`, tombol "Impor" nonaktif; tombol "Unduh templat" memanggil unduhan (`URL.createObjectURL` ditiru seperti tes `Laporan`).
- [ ] **Step 2: Jalankan** `npm test -w apps/web -- ImporEvent` — Expected: FAIL.
- [ ] **Step 3: Implementasikan** layar dan rute.
- [ ] **Step 4: Jalankan** `npm test -w apps/web` dan `npx tsc --noEmit -p apps/web` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): layar impor event dari Excel`.

---

### Task 9: Verifikasi akhir

- [ ] **Step 1:** `npm test -w packages/shared && npm test -w apps/api && npm test -w apps/web` — Expected: semua lulus.
- [ ] **Step 2:** `npx tsc --noEmit -p apps/web` dan `npx vite build` di `apps/web` — Expected: tanpa galat.
- [ ] **Step 3:** Uji manual dengan `run` skill atau dev server: buat 3 kategori, impor templat, buka Kalender dan periksa titik melingkar pada hari yang punya banyak kategori di lebar layar 360px (titik tidak terpotong).
- [ ] **Step 4:** Jangan deploy otomatis. Sampaikan ke pengguna bahwa migrasi `0007` harus diterapkan ke produksi (`wrangler d1 migrations apply DB --remote` dari `apps/api`) sebelum `wrangler deploy`, lalu tunggu persetujuan.
