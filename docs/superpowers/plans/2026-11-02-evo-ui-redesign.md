# ENVIRO UI Redesign (Bagian 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti tampilan MVP dengan desain Figma (Bahasa Indonesia, navigasi per peran), tambah Dashboard Manager, Master Pond, Kelola Pengguna.

**Architecture:** Tetap monorepo `packages/shared`, `apps/api` (Hono + D1), `apps/web` (React PWA). API mendapat migrasi 0002, baku mutu per pond, status aktif pengguna, endpoint dashboard. Web dibangun ulang di atas token, ikon, dan komponen Figma dengan rute per peran.

**Tech Stack:** TypeScript, Hono, D1, React 18, React Router, Vitest, Inter.

**Spec:** `docs/superpowers/specs/2026-11-02-evo-ui-redesign-design.md` (juga baca `docs/superpowers/specs/2026-11-02-evo-mvp-design.md` dan gambar di `design/`)

## Global Constraints

- Warna persis Figma: primary `#0E7C66`, primary-dark `#0A5C4B`, primary-soft `#E3F4EF`, water `#1C7ED6`, water-soft `#E4F0FB`, bg `#F4F7F6`, surface `#FFFFFF`, text `#12201C`, text-sub `#5E6E69`, border `#DAE3E0`, success `#12A150`, success-soft `#DDF5E6`, warning `#D97706`, warning-soft `#FFF1D6`, danger `#D92D20`, danger-soft `#FEE4E2`, camera `#101614`; Auditor badge `#EDE9FB` / `#5B3FA8`. Tidak digelapkan (keputusan pemilik produk).
- Huruf Inter. Angka tabular.
- Teks UI dan pesan galat API dalam Bahasa Indonesia. Tombol berupa kata kerja: "Simpan data cuaca", "Simpan data air", "Simpan data koagulan".
- Format tampilan id-ID: `1.278,7`, `12,5`, `Senin, 2 Nov 2026`. Input menerima koma atau titik. Database tetap angka biasa.
- Admin punya akses penuh. Tulis data: Operator dan Admin. Manager dan Auditor baca saja.
- Baku mutu per pond, hanya outlet: kunci `ph_outlet`, `tss_outlet`. Null di salah satu sisi berarti tanpa batas. Tidak pernah memblokir simpan.
- Yang belum dibangun tidak ditampilkan: chip Tersinkron, kartu Event, banner overdue, tab Kalender, Laporan, Eviden. Chip koneksi hanya saat luring.
- Tab: Operator dan Admin: Beranda, Input, Akun. Manager: Beranda, Akun. Auditor: Riwayat, Akun. Akun memuat "Riwayat data" (kecuali Auditor) dan, untuk Admin, Pengguna dan Master. ≥ 900px: rel kiri.
- Tidak ada glow, gradien dekoratif, emoji, animasi masuk. Gerak hanya respons tekan dan denyut sekali saat nilai melewati baku mutu, dan menghormati `prefers-reduced-motion`.
- Layar harus bekerja di lebar 360px, fokus keyboard terlihat, target sentuh ≥ 44px, tanpa overflow horizontal.
- Setiap layar data punya keadaan kosong, memuat, dan galat yang menyebut sebab dan langkah berikutnya.
- Admin aktif terakhir tidak boleh dinonaktifkan atau diturunkan perannya. Admin tidak boleh menonaktifkan dirinya sendiri.

## Review Focus

- Pengguna dinonaktifkan saat masih punya sesi: langsung kehilangan akses (sesi dihapus dan guard menolak).
- Admin aktif terakhir: tidak bisa dinonaktifkan atau diturunkan, termasuk lewat ubah peran.
- Pond tanpa baku mutu, atau TSS maksimum kosong: tidak ada penilaian Normal/Abnormal dan tidak ada galat.
- Dashboard tanpa data di rentang, atau dengan hari bolong: pesan kosong jujur, celah di garis, bukan nol.
- Angka berformat Indonesia: "7,2" diterima, "1.278,7" ditolak dengan pesan jelas, tampilan memakai format id-ID.
- Peran membuka rute yang bukan haknya (Manager ke `/input`, Operator ke `/master`): dialihkan, dan API menolak tulis.

---

### Task 1: Shared: format Indonesia dan kunci baku mutu

**Files:**
- Create: `packages/shared/src/format.ts`
- Modify: `packages/shared/src/types.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/format.test.ts`

**Interfaces:**
- Produces:
  - `formatNumber(n: number | null, maxDecimals?: number): string` (id-ID, `null` -> `–`)
  - `formatDateId(isoDate: string): string` -> "Senin, 2 Nov 2026"
  - `parseLocaleNumber(raw: string): number | null | 'invalid'` (koma atau titik sebagai desimal; "1.278,7" -> `'invalid'`)
  - `THRESHOLD_KEYS = ['ph_outlet','tss_outlet'] as const`; `ROLE_LABEL: Record<Role,string>`

- [ ] **Step 1: Tes gagal**: `formatNumber(1278.72,1)==='1.278,7'`; `formatNumber(12.5)==='12,5'`; `formatNumber(null)==='–'`; `formatNumber(260)==='260'`; `formatDateId('2026-11-02')==='Senin, 2 Nov 2026'`; `parseLocaleNumber('7,2')===7.2`; `parseLocaleNumber('7.2')===7.2`; `parseLocaleNumber('1.278,7')==='invalid'`; `parseLocaleNumber('')===null`; `parseLocaleNumber('abc')==='invalid'`; `THRESHOLD_KEYS` sama dengan `['ph_outlet','tss_outlet']`.
- [ ] **Step 2:** Jalankan `npm test -w @evo/shared`. Expected: FAIL.
- [ ] **Step 3:** Implementasi dengan `Intl.NumberFormat('id-ID')` dan `Intl.DateTimeFormat('id-ID', {timeZone:'UTC'})`; ekspor dari `index.ts`.
- [ ] **Step 4:** Jalankan `npm test`. Expected: shared lulus; api gagal pada tes `thresholds` lama (diperbaiki di Task 2).
- [ ] **Step 5:** Commit `feat(shared): format id-ID, kunci baku mutu`.

### Task 2: API: migrasi 0002, pond dan baku mutu per pond

**Files:**
- Create: `apps/api/migrations/0002_redesign.sql`
- Modify: `apps/api/src/admin/ponds.ts`, `apps/api/src/index.ts`, `apps/api/test/setup.ts`, `apps/api/test/helpers.ts`, `apps/api/test/admin.test.ts`
- Delete: `apps/api/src/admin/thresholds.ts`

**Interfaces:**
- Consumes: `THRESHOLD_KEYS`, `parseNumber`, `isValidDate`.
- Produces:
  - Tabel `pond_thresholds(sp_id, key, min, max)`; kolom `settling_ponds.code/latitude/longitude`; kolom `users.is_active`; tabel `thresholds` dihapus.
  - `GET /ponds` -> `{id, code, name, latitude, longitude, is_active, thresholds: Record<ThresholdKey,{min:number|null,max:number|null}>}[]` (`?all=1` untuk siapa pun yang masuk).
  - `POST /ponds {code?, name, latitude?, longitude?, thresholds?}` dan `PATCH /ponds/:id` (bidang yang sama + `is_active`), hanya Admin. Validasi: latitude -90..90, longitude -180..180, min <= max, kunci dikenal, angka berupa angka. Nama atau kode ganda -> 409.

- [ ] **Step 1: Tes gagal** (ganti tes `thresholds` global): admin membuat pond dengan kode, koordinat, dan baku mutu lalu `GET /ponds` mengembalikannya; pond tanpa baku mutu mengembalikan `thresholds` `{}`; `PATCH` mengubah baku mutu tanpa menyentuh pond lain; kunci tak dikenal -> 400; min > maks -> 400; latitude 91 -> 400; kode ganda -> 409; Operator `POST` -> 403; `all=1` oleh Operator menampilkan pond nonaktif; `TSS max` null diterima.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api`. Expected: FAIL.
- [ ] **Step 3:** Tulis migrasi 0002 (ALTER TABLE tambah kolom, CREATE TABLE `pond_thresholds`, DROP TABLE `thresholds`). Ubah `ponds.ts`: satu query pond, satu query semua `pond_thresholds` lalu gabung di memori. Hapus rute `/thresholds` dari `index.ts`. Perbarui `setup.ts` menghapus `pond_thresholds` bukan `thresholds`.
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): pond lengkap dan baku mutu per pond`.

### Task 3: API: pengguna aktif/nonaktif dan penjaga admin terakhir

**Files:**
- Modify: `apps/api/src/admin/users.ts`, `apps/api/src/auth/routes.ts`, `apps/api/src/auth/session.ts`
- Test: `apps/api/test/admin.test.ts`, `apps/api/test/auth.test.ts`

**Interfaces:**
- Produces: `GET /users` mengembalikan `is_active`; `PATCH /users/:id` menerima `is_active` (boolean sungguhan) dan `role`; `getSessionUser` hanya mengembalikan pengguna aktif.

- [ ] **Step 1: Tes gagal**: pengguna nonaktif login -> 401 dengan pesan "Akun nonaktif. Hubungi admin."; menonaktifkan pengguna yang punya sesi membuat `/auth/me` -> 401; admin tidak bisa menonaktifkan dirinya (409); admin aktif terakhir tidak bisa diturunkan perannya (409); admin kedua boleh; mengaktifkan kembali memulihkan login; `is_active: "false"` (string) -> 400.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api`. Expected: FAIL.
- [ ] **Step 3:** Tambah pengecekan di login (cek `is_active` setelah verifikasi sandi agar waktu respons sama), join `u.is_active = 1` di `getSessionUser`, hapus sesi saat nonaktif, penjaga admin terakhir dengan menghitung admin aktif.
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): pengguna aktif/nonaktif`.

### Task 4: API: endpoint dashboard

**Files:**
- Create: `apps/api/src/entries/dashboard.ts`, `apps/api/test/dashboard.test.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `m3sToM3d`, `isValidDate`, `COAGULANT_TYPES`.
- Produces: `GET /dashboard?sp=&days=7|30|90&date=` (semua peran masuk) -> `{ date, days, today: { ph_outlet, tss_outlet, debit_outlet_m3s, debit_outlet_m3d, rainfall_mm, rain_hours } | null, series: { date, ph_inlet, ph_outlet }[] (satu entri per hari di rentang, nilai null untuk hari bolong), coagulant: Record<CoagulantType,{remaining:number|null, max:number|null, updated:string|null}>, thresholds }`. Rentang berakhir di `date` (default hari ini).

- [ ] **Step 1: Tes gagal**: `days` selain 7/30/90 -> 400; `sp` tak dikenal -> 404; seri berisi tepat `days` entri berurutan naik dengan null untuk hari tanpa data; `today.debit_outlet_m3d === debit_outlet_m3s*86400`; tanpa data pada `date`, `today` null; koagulan mengembalikan sisa terkini dan sisa tertinggi dalam rentang; semua peran (Auditor, Manager) bisa membaca; jumlah query D1 <= 6 (pakai pembungkus `prepare` seperti tes riwayat).
- [ ] **Step 2:** Jalankan `npm test -w @evo/api`. Expected: FAIL.
- [ ] **Step 3:** Implementasi dengan satu query air untuk rentang, satu cuaca pada `date`, satu koagulan `date <= ?` urut per jenis, satu baku mutu, lalu susun di memori.
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): endpoint dashboard`.

### Task 5: API: pesan galat Bahasa Indonesia

**Files:**
- Modify: semua berkas di `apps/api/src/**` yang memanggil `c.json({ error: ... })`; `apps/api/test/*.test.ts` yang menegaskan teks galat

**Interfaces:**
- Produces: pesan galat berbahasa Indonesia, menyebut sebab dan perbaikan. Daftar baku: login salah "Email atau kata sandi salah."; belum masuk "Silakan masuk dulu."; peran tak cukup "Peran Anda tidak boleh mengubah data."; bukan admin "Hanya admin yang boleh melakukan ini."; tanggal "Tanggal harus berbentuk 2026-11-02."; angka "{label} harus berupa angka."; pond mati "Settling pond ini nonaktif. Minta admin mengaktifkannya."; galat umum "Terjadi kesalahan. Coba lagi."

- [ ] **Step 1: Tes gagal**: ubah tes yang menegaskan teks (login salah, pH di luar rentang, pond nonaktif, tanggal salah) agar menegaskan pesan Indonesia di atas.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api`. Expected: FAIL pada tes yang diubah.
- [ ] **Step 3:** Terjemahkan seluruh pesan, termasuk label bidang di `readNumbers` ("pH inlet", "Curah hujan", "Jam hujan", "Aliran masuk", dst).
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: semua PASS.
- [ ] **Step 5:** Commit `feat(api): pesan galat Bahasa Indonesia`.

### Task 6: Web: fondasi (token, Inter, ikon, komponen)

**Files:**
- Create: `apps/web/src/styles/tokens.css` (ganti), `apps/web/src/icons/index.tsx`, `apps/web/src/ui/Button.tsx`, `Badge.tsx`, `Card.tsx`, `Segmented.tsx`, `Toggle.tsx`, `Banner.tsx`, `ScreenHeader.tsx`, `PondPicker.tsx`, `ConnectionChip.tsx`
- Modify: `apps/web/index.html` (Inter), `apps/web/src/styles/base.css`, `apps/web/src/components/NumberField.tsx` (restyle, id-ID, status auto/abnormal)
- Test: `apps/web/src/ui/ui.test.tsx`, `apps/web/src/components/NumberField.test.tsx` (diperbarui)

**Interfaces:**
- Consumes: `formatNumber`, `parseLocaleNumber`, `isOutOfLimit`.
- Produces:
  - `Icon` set: `Icon({name, size?, label?})` dengan nama dari spec bagian 4; tanpa `label` ikon `aria-hidden`.
  - `Button({variant:'primary'|'outline'|'danger', ...})`, `Badge({tone:'success'|'danger'|'danger-solid'|'primary'|'water'|'warning'})`, `Segmented({options, value, onChange})`, `Toggle({checked, onChange, label})`, `Banner({tone:'info'|'warning'|'danger', title, children})`, `ScreenHeader({title, subtitle, onProfile})`, `PondPicker({ponds, value, onChange})`, `ConnectionChip()` (tidak merender apa pun saat online; "Tidak ada koneksi" saat luring).
  - `NumberField({label, unit, value, onChange, threshold?, auto?, error?, readOnly?, hint?})`: tampilan id-ID, `inputMode="decimal"`, pesan "Masukkan angka" untuk teks tak valid, kelas `is-alert` bila di luar baku mutu dengan pesan `hint` "Di luar baku mutu {min}-{maks}", chip "Otomatis" bila `auto`.

- [ ] **Step 1: Tes gagal**: `Button` varian danger memakai kelas `btn-danger`; `Segmented` memanggil `onChange` dan menandai `aria-selected`; `Toggle` role `switch` dengan `aria-checked`; `Badge tone="danger"` menampilkan teks; `ConnectionChip` menampilkan "Tidak ada koneksi" saat `navigator.onLine=false` dan kosong saat true; `NumberField`: nilai 5,8 dengan baku mutu 6-9 -> kelas `is-alert` dan teks "Di luar baku mutu 6-9"; `7,2` mengirim 7.2; `abc` menampilkan "Masukkan angka" dan `aria-invalid`; `auto` menampilkan "Otomatis"; nilai 1278.7 tampil "1.278,7" saat blur; tanpa ikon tanpa label tidak ada nama aksesibel kosong pada tombol berikon.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Tulis token CSS dari Global Constraints, muat Inter dari Google Fonts, gambar ikon sebagai SVG 24px (stroke `currentColor`, 1,75), implementasikan komponen, restyle `NumberField`. Hapus gaya MVP lama yang bentrok (chips, flowstrip, savebar lama).
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS (tes layar lama akan diperbarui di Task 8 dan 10; hapus yang usang bersama berkasnya).
- [ ] **Step 5:** Commit `feat(web): fondasi Figma, ikon, komponen`.

### Task 7: Web: navigasi per peran, rute, Akun

**Files:**
- Create: `apps/web/src/nav/nav.ts`, `apps/web/src/components/TabBar.tsx` (ganti), `apps/web/src/components/SideRail.tsx`, `apps/web/src/screens/Akun.tsx`, `apps/web/src/pond/PondContext.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/nav/nav.test.tsx`

**Interfaces:**
- Consumes: `Role`, `ROLE_LABEL`, `api('/ponds')`.
- Produces:
  - `navFor(role): {tabs: NavItem[], manage: NavItem[], more: NavItem[]}` dengan `NavItem = {to:string, label:string, icon:IconName}` sesuai tabel spec bagian 2.
  - `homeFor(role): string` (`/` atau `/riwayat` untuk Auditor).
  - `PondProvider` / `usePond(): {ponds, current, setCurrent, loading, error}`; pond terakhir disimpan di `localStorage` dengan try/catch; pond tak ada atau nonaktif jatuh ke pond aktif pertama.
  - `RequireRole({allow, children})` mengalihkan ke `homeFor(role)`.

- [ ] **Step 1: Tes gagal**: `navFor('Operator').tabs` labelnya `['Beranda','Input','Akun']`; Manager `['Beranda','Akun']`; Auditor `['Riwayat','Akun']`; Admin tabs `['Beranda','Input','Akun']` dan `manage` memuat Pengguna dan Master; `homeFor('Auditor')==='/riwayat'`; render `App` sebagai Manager di `/input` -> terlihat Dashboard; Operator di `/master` -> beranda; Akun menampilkan nama, peran "Operator", dan tombol "Keluar"; Akun Admin menampilkan menu Pengguna dan Master; Akun Auditor tidak menampilkan "Riwayat data"; `PondProvider` jatuh ke pond aktif pertama saat nilai tersimpan tidak valid, dan tidak melempar saat `localStorage` rusak.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi `nav.ts`, tab bawah dengan pil pilihan (≤ 899px) dan `SideRail` (≥ 900px), `Akun`, `PondContext`, rute baru dengan placeholder untuk layar yang dibuat di Task 8 sampai 10.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): navigasi per peran dan Akun`.

### Task 8: Web: Beranda Operator, hub Input, tiga layar input

**Files:**
- Create: `apps/web/src/screens/BerandaOperator.tsx`, `InputHub.tsx`, `InputCuaca.tsx`, `InputAir.tsx`, `InputKoagulan.tsx`, `apps/web/src/hooks/useDay.ts` (diperluas dengan `reload`), `apps/web/src/components/DayScope.tsx`
- Delete: `apps/web/src/screens/Today.tsx`, `DayForm.tsx`, `Today.test.tsx`, `apps/web/src/components/FlowStrip.tsx` (+tesnya), `PondChips.tsx`, `SaveBar.tsx`, `apps/web/src/hooks/useThresholds.ts`
- Test: `apps/web/src/screens/BerandaOperator.test.tsx`, `InputCuaca.test.tsx`, `InputAir.test.tsx`, `InputKoagulan.test.tsx`

**Interfaces:**
- Consumes: `usePond`, `useDay(date, sp)`, `PUT /weather`, `/water`, `/coagulant`, `NumberField`, `Banner`, `Button`, `formatNumber`, `formatDateId`.
- Produces:
  - `DayScope`: kepala tanggal dan pond, memuat `/day`, menampilkan memuat/galat, dan hanya menampilkan anaknya saat data siap; anak dikunci `${date}|${sp}|${version}` agar status form selalu berasal dari data. Tidak ada tombol simpan saat memuat, galat, pond nonaktif, atau peran tidak boleh menulis (kolom jadi baca saja).
  - Tiga form menolak simpan bila ada kolom bertanda `aria-invalid` ("Perbaiki angka yang ditandai dulu.") dan menampilkan toast "Data cuaca tersimpan", "Data air tersimpan", "Data koagulan tersimpan".
  - `InputAir`: kontrol Inlet/Outlet berbagi satu state; tombol "Simpan data air" mengirim satu `PUT /water` berisi keduanya; debit harian otomatis dari m³/s; pH atau TSS outlet di luar baku mutu pond tersorot dengan pesan.
  - `InputKoagulan`: "Stok awal" dari `previousRemaining`; Sisa otomatis dan boleh ditimpa; peringatan negatif "Stok di bawah nol. Periksa hitungan Anda."
  - `BerandaOperator`: sapaan, kartu modul, kartu "Data hari ini" dengan chip hanya bila baku mutu ada, keadaan kosong dengan tombol "Isi data air".

- [ ] **Step 1: Tes gagal**: Beranda menampilkan "Halo, Rudi" untuk nama "Rudi Hartono", pH outlet 5,8 dengan baku mutu 6-9 -> badge "Abnormal"; tanpa baku mutu -> tidak ada badge; tanpa data air -> "Belum ada data air hari ini." dan tombol "Isi data air"; Input Cuaca menyimpan ke `/api/weather/2026-11-02` dan tidak menyimpan saat ada teks "abc" (muncul "Perbaiki angka yang ditandai dulu."); Input Air: satu simpan mengirim `ph_inlet` dan `ph_outlet` sekaligus ke `/api/water/{tanggal}/{sp}`; debit 0,0148 m³/s menampilkan "1.278,7" otomatis; pH 5,8 menampilkan "Di luar baku mutu 6-9" dan tetap bisa disimpan; Input Koagulan: stok awal 200, In 100, Out 40 -> Sisa "260"; Out 500 -> peringatan negatif; ganti pond saat `/day` pond baru belum selesai -> tidak ada tombol simpan dan tidak ada kolom; `/day` gagal -> pesan galat tanpa tombol simpan; pond nonaktif lewat query -> baca saja dengan catatan; Manager membuka layar input -> tidak ada tombol simpan.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi sesuai Interfaces, pakai pola kunci `${date}|${sp}|${version}` yang sudah terbukti di `DayForm`. Hapus berkas usang dan tesnya.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): Beranda Operator dan layar Input`.

### Task 9: Web: Dashboard Manager dan grafik

**Files:**
- Create: `apps/web/src/screens/BerandaManager.tsx`, `apps/web/src/components/PhChart.tsx`, `apps/web/src/components/StockBars.tsx`, `apps/web/src/hooks/useDashboard.ts`
- Test: `apps/web/src/components/PhChart.test.tsx`, `StockBars.test.tsx`, `apps/web/src/screens/BerandaManager.test.tsx`

**Interfaces:**
- Consumes: `GET /api/dashboard`, `isOutOfLimit`, `formatNumber`, `Segmented`.
- Produces:
  - `PhChart({series, band, labelDays})`: SVG dengan garis outlet (primary) dan inlet (water), pita baku mutu bila `band` ada, titik merah untuk nilai di luar pita, putus garis pada hari null, legenda teks, `role="img"` dengan `aria-label` yang merangkum nilai terakhir, dan tabel tersembunyi visual berisi datanya untuk pembaca layar.
  - `StockBars({items})`: batang = sisa / sisa tertinggi jenis di rentang, label angka id-ID, keterangan "Dibanding sisa tertinggi dalam rentang".
  - `BerandaManager`: pemilih pond, kontrol 7/30/90 hari, empat kartu, grafik, batang stok; keadaan kosong dan galat.

- [ ] **Step 1: Tes gagal**: `PhChart` dengan 7 titik menggambar dua garis dan satu titik merah untuk 5,8 saat pita 6-9; hari null memutus garis (dua segmen); tanpa pita tidak ada pita dan tidak ada titik merah; `aria-label` memuat nilai terakhir; `StockBars`: 260/260 -> 100%, 87,5/260 -> sekitar 34% dengan teks "87,5"; `BerandaManager`: ganti ke 30 hari memanggil `days=30`; `today` null -> "Belum ada data hari ini." tanpa angka; tanpa data sama sekali -> pesan kosong dan tidak ada `svg` grafik; Manager tidak melihat tombol simpan atau ikon pensil.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi grafik SVG sendiri (tanpa library), skala sumbu dari data dan pita, jumlah label sumbu X menyesuaikan lebar.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): Dashboard Manager`.

### Task 10: Web: Riwayat, Master Pond, Kelola Pengguna

**Files:**
- Create: `apps/web/src/screens/Riwayat.tsx` (ganti `History.tsx`), `Master.tsx`, `Pengguna.tsx`
- Delete: `apps/web/src/screens/History.tsx`, `History.test.tsx`, `Admin.tsx`, `apps/web/src/screens/admin/*`
- Test: `apps/web/src/screens/Riwayat.test.tsx`, `Master.test.tsx`, `Pengguna.test.tsx`

**Interfaces:**
- Consumes: `/history`, `/ponds?all=1`, `/users`, `Toggle`, `Badge`, `NumberField`.
- Produces:
  - `Riwayat`: filter tanggal dan pond, nilai abnormal tersorot memakai baku mutu pond baris itu, penanda "Selisih hitungan stok dengan hari sebelumnya", sentuh baris membuka `/input/air?date=&sp=` (atau modul yang relevan).
  - `Master`: daftar pond (ikon tetes, `{kode} {nama}`, koordinat, chip Aktif/Nonaktif, tombol ubah dengan `aria-label`), formulir Ubah/Tambah sesuai spec, simpan memanggil `POST/PATCH /ponds`; pesan 409 "Kode atau nama sudah dipakai."
  - `Pengguna`: pencarian (nama atau email, huruf besar-kecil diabaikan), filter peran, "{n} pengguna", inisial berwarna menurut peran, saklar aktif, ganti peran, atur ulang kata sandi, formulir Tambah, kartu hak akses dengan Admin bercentang semua.

- [ ] **Step 1: Tes gagal**: Riwayat menyorot pH 5,2 dengan baku mutu pond 6-9 dan tidak menyorot pH 7; baris dengan `staleRemaining` menampilkan penanda; Master: formulir menyimpan baku mutu ke `PATCH /api/ponds/{id}`; TSS maksimum kosong dikirim `null`; 409 menampilkan pesan Indonesia; hanya Admin yang membuka `/master`; Pengguna: mengetik "dewi" menyisakan satu baris; filter "Operator" menyisakan operator; saklar nonaktif memanggil `PATCH /api/users/{id}` dengan `is_active:false`; penolakan 409 admin terakhir menampilkan pesan dari API; Auditor tidak bisa membuka `/pengguna`; kartu hak akses menampilkan centang Admin pada semua baris.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi. Pencarian dan filter dilakukan di klien. Hapus berkas lama dan tesnya.
- [ ] **Step 4:** Jalankan `npm test` dari akar dan `npx tsc --noEmit -p apps/web`. Expected: semua PASS.
- [ ] **Step 5:** Commit `feat(web): Riwayat, Master Pond, Kelola Pengguna`.

### Task 11: Verifikasi, README, laporan Delivery Gate

**Files:**
- Modify: `README.md`; Create: `anti-slop/delivery-gate-2026-11-02.md`

**Interfaces:**
- Produces: laporan PASS/FAIL antislop dengan bukti per butir, termasuk daftar pasangan warna Figma yang gagal AA sebagai keputusan pemilik produk.

- [ ] **Step 1:** Jalankan `npm test`, `npx tsc --noEmit -p apps/web`, `npm run build -w @evo/web`. Expected: semua lulus.
- [ ] **Step 2:** Terapkan migrasi lokal (`wrangler d1 migrations apply evo --local`), seed Admin, jalankan `wrangler dev`; lewat `curl` buat Manager, Operator, Auditor; cek login, `/api/ponds`, `/api/dashboard`, pengguna nonaktif ditolak login.
- [ ] **Step 3:** Telusuri setiap tombol dan tautan per peran di kode dan, bila ada browser, di layar 360px; catat satu per satu (R-35). Bila tidak ada browser, nyatakan verifikasi lewat inspeksi kode.
- [ ] **Step 4:** Tulis laporan Delivery Gate dan perbarui README (rute, peran, migrasi).
- [ ] **Step 5:** Commit `docs: laporan verifikasi UI baru`.
