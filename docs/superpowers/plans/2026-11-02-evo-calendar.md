# EVO Bagian 2: Kalender dan Riwayat Tabel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kalender Enviro Events dengan jadwal berulang, overdue per tanggal, eksekusi event dengan unggah eviden dari galeri (R2), atur jadwal, kartu dan banner di Beranda, serta Riwayat berbentuk tabel.

**Architecture:** Jadwal disimpan sebagai aturan; tanggal tenggat dihitung di `packages/shared` dan dibaca server saat diminta. Database hanya mencatat penyelesaian dan eviden. File eviden di R2 lewat binding `EVIDENCE`, dibaca lewat endpoint ber-sesi. Web menambah layar Kalender, Eksekusi event, Atur jadwal, dan mengganti Riwayat menjadi tabel.

**Tech Stack:** TypeScript, Hono, D1, R2, React 18, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-evo-calendar-design.md` (juga `2026-11-02-evo-ui-redesign-design.md`; gambar `design/06` dan `design/07`)

## Global Constraints

- Frekuensi persis: `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Semi-Annual`, `Annual`; label: Harian, Mingguan, Bulanan, 3-Bulanan, 6-Bulanan, Tahunan.
- Zona waktu situs WITA (`Asia/Makassar`, UTC+8). "Hari ini" dihitung di server dan dikirim ke klien.
- Status: `done`, `overdue` (due < hari ini, belum selesai), `today`, `upcoming`. Selesai terlambat bila `completed_on` > `due_date`.
- Selesai dan unggah eviden hanya bila `due_date` ≤ hari ini. Selesai butuh ≥ 1 eviden. Setelah selesai, eviden terkunci dan penyelesaian tidak bisa dibatalkan.
- Eviden: jpeg, png, webp, heic, atau pdf, ditentukan dari isi file; maksimal 10 MB (10.485.760 byte); file kosong ditolak.
- Hak: Manager dan Admin atur jadwal; Operator dan Admin unggah, hapus, selesaikan; semua peran masuk membaca dan mengunduh.
- `frequency` dan `start_date` terkunci bila jadwal sudah punya penyelesaian atau eviden. Menghentikan jadwal mengisi `ended_on`; tidak ada kejadian setelahnya, yang lampau tetap.
- Daftar overdue maksimal 200 baris, terbaru dulu, dengan `total` yang benar.
- Teks UI dan pesan galat Bahasa Indonesia. Warna dan komponen dari Figma seperti bagian 1; tidak ada gradien, glow, emoji, atau animasi masuk.
- 360px tanpa overflow horizontal, target sentuh ≥ 44px, fokus keyboard terlihat. Tiap layar punya keadaan memuat, kosong, galat.
- Tidak ada URL publik untuk eviden; unduhan memakai `X-Content-Type-Options: nosniff`.

## Review Focus

- Tanggal jangkar 29, 30, 31 dan tahun kabisat: Monthly, Quarterly, Semi-Annual, Annual tidak bergeser berantai dan tidak melewati bulan.
- Berkas palsu (executable bernama `.jpg`), file > 10 MB, file kosong, dan nama file berisi tanda kutip, baris baru, atau `../`: ditolak atau dibersihkan; header unduhan tidak bisa disuntik.
- Unggah yang berbarengan dengan penyelesaian: eviden tidak bisa masuk setelah event selesai (cek dalam satu pernyataan tulis, bukan cek lalu tulis); dua penyelesaian bersamaan: satu berhasil, satu 409.
- Batas hari WITA: pukul 16:30 UTC sudah hari berikutnya di WITA; event bertenggat hari ini tidak overdue dan bertenggat kemarin overdue.
- Jadwal dihentikan: overdue lampau tetap tampil dan bisa diselesaikan, kejadian setelah penghentian tidak muncul, menghentikan dua kali aman.
- Baris eviden ada tetapi objek R2 hilang: unduhan 404, bukan 500. Peran tanpa hak (Manager, Auditor) ditolak 403 pada unggah dan hapus, tetapi bisa mengunduh.

---

### Task 1: Shared: hitungan tenggat, status, zona waktu

**Files:**
- Create: `packages/shared/src/events.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/events.test.ts`

**Interfaces:**
- Produces:
  - `EVENT_FREQUENCIES`, `type EventFrequency`, `FREQUENCY_LABEL: Record<EventFrequency,string>`
  - `type ScheduleRule = { frequency: EventFrequency; start_date: string; ended_on: string | null }`
  - `dueDates(rule: ScheduleRule, from: string, to: string): string[]` (naik, inklusif, hormati `start_date` dan `ended_on`, maksimal 20.000 langkah)
  - `isDueDate(rule: ScheduleRule, date: string): boolean`
  - `todayInSite(now?: Date): string` (WITA)
  - `type EventStatus = 'done'|'overdue'|'today'|'upcoming'`; `eventStatus(due: string, today: string, completedOn: string | null): EventStatus`; `isLate(due: string, completedOn: string | null): boolean`
  - `type EventOccurrence = { schedule_id: string; title: string; description: string | null; frequency: EventFrequency; sp_id: string | null; assigned_to_name: string | null; due_date: string; status: EventStatus; late: boolean; evidence_count: number; completed_at: string | null; completed_by_name: string | null }`

- [ ] **Step 1: Tes gagal** dengan nilai persis: Daily mulai 2026-11-01, `dueDates(…,'2026-11-03','2026-11-05')` = tiga tanggal; Weekly mulai 2026-11-02 pada rentang 2026-11-01..2026-11-30 = `['2026-11-02','2026-11-09','2026-11-16','2026-11-23','2026-11-30']`; Monthly jangkar 31 mulai 2026-01-31 = `['2026-01-31','2026-02-28','2026-03-31','2026-04-30']`; Monthly jangkar 29 mulai 2028-01-29 memberi `2028-02-29` dan `2029-02-28` pada Monthly Feb tahun berikut; Quarterly mulai 2026-11-30 = `2026-11-30, 2027-02-28, 2027-05-30`; Semi-Annual mulai 2026-08-31 = `2026-08-31, 2027-02-28`; Annual mulai 2028-02-29 = `2028-02-29, 2029-02-28, 2032-02-29`; tidak ada tanggal sebelum `start_date`; `ended_on` '2026-11-10' memotong Daily; `isDueDate` benar untuk 2026-11-09 Weekly mulai 2026-11-02 dan salah untuk 2026-11-10; `todayInSite(new Date('2026-11-02T16:30:00Z'))==='2026-11-03'` dan `new Date('2026-11-02T15:59:00Z')` memberi `'2026-11-02'`; `eventStatus('2026-11-01','2026-11-02',null)==='overdue'`, `('2026-11-02','2026-11-02',null)==='today'`, `('2026-11-03','2026-11-02',null)==='upcoming'`, `('2026-11-01','2026-11-02','2026-11-02')==='done'`; `isLate('2026-11-01','2026-11-02')===true`, `isLate('2026-11-02','2026-11-02')===false`, `isLate('2026-11-02',null)===false`.
- [ ] **Step 2:** Jalankan `npm test -w @evo/shared`. Expected: FAIL.
- [ ] **Step 3:** Implementasi. Untuk bulanan dan setelahnya hitung tiap kejadian dari jangkar (bulan mulai + k·n bulan, hari = min(jangkar, hari terakhir bulan itu)), bukan dengan menambah dari kejadian sebelumnya. Tanggal ISO dihitung di UTC.
- [ ] **Step 4:** Jalankan `npm test -w @evo/shared`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(shared): tenggat event, status, zona WITA`.

### Task 2: API: migrasi 0003, R2, jadwal

**Files:**
- Create: `apps/api/migrations/0003_events.sql`, `apps/api/src/events/schedules.ts`
- Modify: `apps/api/src/types.ts` (`Env.EVIDENCE: R2Bucket`), `apps/api/src/index.ts`, `apps/api/wrangler.jsonc` dan `apps/api/wrangler.test.jsonc` (`r2_buckets: [{ binding: "EVIDENCE", bucket_name: "evo-evidence" }]`), `apps/api/test/setup.ts` (hapus `evidences`, `event_completions`, `event_schedules` sebelum `users`)
- Test: `apps/api/test/schedules.test.ts`

**Interfaces:**
- Consumes: `EVENT_FREQUENCIES`, `isValidDate`, `todayInSite`, `requireAuth`, `requireAdmin`.
- Produces:
  - Tabel `event_schedules`, `event_completions`, `evidences` sesuai spec bagian 3.
  - Middleware `requireScheduler` (Manager atau Admin, 403 "Hanya Manager atau Admin yang boleh mengatur jadwal.") dan `requireExecutor` (Operator atau Admin, 403 "Hanya Operator atau Admin yang boleh mengerjakan event.") di `apps/api/src/auth/guard.ts`.
  - `GET /schedules` -> `{id,title,description,frequency,start_date,sp_id,assigned_to,assigned_to_name,ended_on,locked:boolean}[]` (`?all=1` menyertakan yang berhenti); `POST /schedules {title,description?,frequency,start_date,sp_id?,assigned_to?}` -> 201 `{id}`; `PATCH /schedules/:id`; `POST /schedules/:id/stop`.

- [ ] **Step 1: Tes gagal**: Manager dan Admin membuat jadwal, Operator dan Auditor mendapat 403; judul kosong, frekuensi tak dikenal, `start_date` tak valid, `sp_id` tak ada semuanya 400/404 dengan pesan Indonesia; semua peran bisa `GET /schedules`; yang berhenti hanya tampil dengan `?all=1`; `PATCH` mengubah judul kapan saja; `PATCH` mengubah `frequency` atau `start_date` pada jadwal yang punya penyelesaian atau eviden -> 409 "Frekuensi dan tanggal mulai tidak bisa diubah karena jadwal ini sudah punya catatan." dan `locked:true` di daftar (isi baris `event_completions` langsung lewat SQL pada tes); `stop` mengisi `ended_on` dengan `todayInSite()`; `stop` kedua tetap 200 dan tidak mengubah `ended_on`; `assigned_to` harus pengguna aktif yang ada.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api`. Expected: FAIL.
- [ ] **Step 3:** Tulis migrasi 0003 dan rute. Tabel `evidences` punya indeks `(schedule_id, due_date)`. Dua binding R2 di kedua wrangler.
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): jadwal event dan binding R2`.

### Task 3: API: kejadian (baca)

**Files:**
- Create: `apps/api/src/events/events.ts`, `apps/api/test/events.test.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `dueDates`, `isDueDate`, `eventStatus`, `isLate`, `todayInSite`, `EventOccurrence`.
- Produces:
  - `GET /events?from=&to=&frequency=&sp=` -> `{ today, events: EventOccurrence[] }` (rentang ≤ 62 hari; urut `due_date` lalu judul; `sp` menyertakan jadwal pond itu dan jadwal tanpa pond).
  - `GET /events/overdue?frequency=&sp=` -> `{ today, total, events: EventOccurrence[] }` (maks 200, terbaru dulu).
  - `GET /events/summary` -> `{ today, overdue, due_today }` (`overdue` adalah total sebenarnya).
  - `GET /events/:scheduleId/:date` -> `{ today, event: EventOccurrence, evidences: {id,filename,mime,size,uploaded_by_name,uploaded_at}[] }`; 404 "Event tidak ditemukan." bila tanggal itu bukan tenggat jadwal.

- [ ] **Step 1: Tes gagal**: rentang > 62 hari 400; tanggal salah 400; hari bolong tidak muncul; jadwal Weekly hanya muncul pada tanggal kelipatannya; status `overdue`, `today`, `upcoming`, `done` benar untuk tanggal tenggat 3 hari lalu, hari ini, lusa, dan yang ada baris selesai; `late` benar untuk selesai setelah tenggat; filter `frequency` dan `sp`; jadwal berhenti tidak punya kejadian setelah `ended_on` tetapi overdue sebelumnya tetap ada; overdue dengan 250 hari belum selesai mengembalikan 200 baris dan `total === 250`, urut terbaru dulu; `summary.overdue` cocok dengan `total`; semua peran (Auditor, Manager, Operator, Admin) bisa membaca; tanpa sesi 401; detail untuk tanggal yang bukan tenggat 404; jumlah query D1 untuk `GET /events` pada 20 jadwal ≤ 6 (pembungkus `prepare` seperti tes dashboard).
- [ ] **Step 2:** Jalankan `npm test -w @evo/api`. Expected: FAIL.
- [ ] **Step 3:** Implementasi dengan satu query jadwal, satu query penyelesaian dan jumlah eviden untuk rentang tanggal, lalu susun di memori. Nama pengguna lewat join.
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): daftar dan detail kejadian event`.

### Task 4: API: eviden dan penyelesaian

**Files:**
- Create: `apps/api/src/events/evidence.ts`, `apps/api/src/events/sniff.ts`, `apps/api/test/evidence.test.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `requireExecutor`, `isDueDate`, `todayInSite`, `env.EVIDENCE`.
- Produces:
  - `sniffMime(bytes: Uint8Array): 'image/jpeg'|'image/png'|'image/webp'|'image/heic'|'application/pdf'|null`
  - `safeFilename(name: string): string` (hapus jalur, karakter kontrol, tanda kutip; maks 100 karakter; kosong menjadi `berkas`)
  - `POST /events/:scheduleId/:date/evidence` (multipart, kolom `file`) -> 201 `{id,filename,mime,size}`; `DELETE /evidence/:id`; `GET /evidence/:id/file`; `POST /events/:scheduleId/:date/complete` -> 200 `{completed_at,completed_on,late}`.

- [ ] **Step 1: Tes gagal**: JPEG, PNG, WEBP, HEIC, dan PDF sah diterima dan tersimpan di R2 dengan `mime` dari isi; berkas berawal `MZ` bernama `a.jpg` dan teks biasa ditolak 400 "Jenis berkas tidak didukung. Gunakan foto atau PDF."; file 10 MB + 1 byte ditolak 413 "Berkas terlalu besar. Maksimal 10 MB."; tepat 10 MB diterima; file kosong 400; tanpa kolom `file` 400; tanggal mendatang 409 "Event ini belum waktunya."; tanggal yang bukan tenggat 404; event sudah selesai 409 "Event sudah selesai. Eviden tidak bisa diubah."; Manager dan Auditor unggah 403; Operator dan Admin 201; hapus oleh pengunggah atau Admin 200, oleh Operator lain 403; hapus setelah selesai 409; `complete` tanpa eviden 409 "Unggah minimal satu eviden dulu."; `complete` pertama 200, kedua 409; `complete` oleh Manager 403; `late` true bila selesai hari setelah tenggat; unduhan oleh semua peran 200 dengan `content-type` dari mime tersimpan, `x-content-type-options: nosniff`, dan `content-disposition: attachment` untuk PDF; nama file `a"b\r\nX-Evil: 1/../x.jpg` menghasilkan header unduhan yang tidak berisi baris baru atau tanda kutip tak lolos; baris eviden dengan objek R2 yang dihapus -> unduhan 404; tanpa sesi 401. Uji balapan: pembungkus D1 yang menyelesaikan event persis sebelum INSERT eviden membuat unggah gagal 409 dan tidak ada baris eviden baru.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api`. Expected: FAIL.
- [ ] **Step 3:** Implementasi. Baca tubuh dengan batas 10 MB + 1 sebelum `formData` bila `content-length` tersedia dan tetap cek ukuran sesudahnya. INSERT eviden ditulis sebagai `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM event_completions ...)` dan `changes === 0` berarti 409. Hapus objek R2 setelah baris dihapus. `complete` memakai `INSERT` ke tabel dengan kunci primer dan 409 pada konflik, dengan syarat `EXISTS` eviden dalam pernyataan yang sama.
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): eviden dan penyelesaian event`.

### Task 5: Web: navigasi, klien FormData, Beranda event

**Files:**
- Create: `apps/web/src/hooks/useEventSummary.ts`
- Modify: `apps/web/src/nav/nav.ts`, `apps/web/src/App.tsx`, `apps/web/src/api/client.ts`, `apps/web/src/screens/BerandaOperator.tsx`, `apps/web/src/screens/Akun.tsx`, `apps/web/src/icons/index.tsx` (ikon `upload`, `trash`, `chevron-left`), `apps/web/src/test-utils.tsx`
- Test: `apps/web/src/nav/nav.test.tsx` (diperbarui), `apps/web/src/api/client.test.ts`, `apps/web/src/screens/BerandaOperator.test.tsx`

**Interfaces:**
- Consumes: `GET /events/summary`.
- Produces:
  - Tab `Kalender` (`/kalender`, ikon `calendar`) untuk semua peran, berurutan: Operator dan Admin Beranda, Input, Kalender, Akun; Manager Beranda, Kalender, Akun; Auditor Kalender, Riwayat, Akun. Menu Akun memuat "Atur jadwal" (`/kalender/jadwal`) untuk Manager dan Admin.
  - `useEventSummary(): { summary: {today:string; overdue:number; due_today:number} | null; error: string }`
  - `api()` tidak memasang `content-type: application/json` bila `body` adalah `FormData`.
  - Rute `/kalender`, `/kalender/jadwal` (Manager dan Admin), `/kalender/:scheduleId/:date` dengan layar sementara sampai Task 6 sampai 8.

- [ ] **Step 1: Tes gagal**: label tab per peran sesuai daftar di atas; Akun Manager memuat tautan "Atur jadwal", Operator tidak; `api('/x', {method:'POST', body: new FormData()})` tidak mengirim header `content-type` JSON; Beranda Operator menampilkan kartu "Event Enviro" dengan "2 event overdue" dan banner merah "2 event overdue" yang menautkan ke `/kalender` bila `summary.overdue === 2`, dan "Tidak ada yang telat" tanpa banner bila 0; kegagalan summary tidak merusak Beranda.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi sesuai Interfaces. Tambahkan stub layar Kalender, Eksekusi, dan Atur jadwal.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): tab Kalender dan kartu event di Beranda`.

### Task 6: Web: layar Kalender

**Files:**
- Create: `apps/web/src/screens/Kalender.tsx`, `apps/web/src/components/WeekStrip.tsx`, `apps/web/src/components/EventCard.tsx`, `apps/web/src/hooks/useEvents.ts`
- Test: `apps/web/src/screens/Kalender.test.tsx`, `apps/web/src/components/WeekStrip.test.tsx`

**Interfaces:**
- Consumes: `GET /events`, `GET /events/overdue`, `EventOccurrence`, `FREQUENCY_LABEL`, `formatDateId`.
- Produces:
  - `WeekStrip({ weekStart, selected, today, marks, onSelect, onPrev, onNext })` dengan `marks: Record<string,'overdue'|'scheduled'>`; tombol hari berlabel "Sen 2" dan `aria-pressed`.
  - `EventCard({ event, canAct })`: kartu merah untuk overdue dengan tombol (tautan) "Unggah eviden" menuju `/kalender/{jadwal}/{tanggal}` bila `canAct`; kartu biasa dengan badge "Hari ini" atau tanggal ("12 Nov"); selesai berbadge "Selesai" atau "Selesai terlambat".
  - Kalender: chip frekuensi (Semua, Harian, Mingguan, Bulanan, 3-Bulanan, 6-Bulanan, Tahunan), daftar Overdue di atas lalu kejadian pada hari terpilih, tombol "Atur jadwal" untuk Manager dan Admin.

- [ ] **Step 1: Tes gagal**: strip menampilkan 7 hari Sen sampai Min, hari ini bertanda, titik merah untuk tanggal dengan overdue dan biru untuk terjadwal, klik hari memanggil `onSelect`; tombol minggu sebelum dan sesudah menggeser 7 hari; Kalender menampilkan kartu overdue dengan teks "Overdue" dan tautan "Unggah eviden" untuk Operator, tanpa tautan untuk Manager dan Auditor; filter "Harian" memanggil API dengan `frequency=Daily` dan hanya menampilkan hasilnya; "Tidak ada event pada tanggal ini." bila kosong; "Ada 250 event overdue, 200 teratas ditampilkan." bila `total` > baris; galat tampil sebagai `role=alert`; tombol "Atur jadwal" hanya untuk Manager dan Admin; kartu selesai terlambat menampilkan "Selesai terlambat".
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi. Hari terpilih awal = `today` dari server. Titik tanda minggu diambil dari satu panggilan `GET /events` untuk rentang minggu plus daftar overdue.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): layar Kalender`.

### Task 7: Web: Eksekusi event dan unggah eviden

**Files:**
- Create: `apps/web/src/screens/EventDetail.tsx`
- Test: `apps/web/src/screens/EventDetail.test.tsx`

**Interfaces:**
- Consumes: `GET /events/:id/:date`, `POST .../evidence`, `DELETE /evidence/:id`, `GET /evidence/:id/file`, `POST .../complete`, `api()` dengan `FormData`.
- Produces: layar dengan judul, status badge, pond dan tenggat, deskripsi, daftar eviden (gambar dipratinjau lewat `<img src="/api/evidence/{id}/file">` dengan `alt` nama file, PDF sebagai tautan unduh, ukuran dalam KB atau MB id-ID, pengunggah, hapus), tombol "Unggah galeri" (input file `accept="image/*,application/pdf"`), banner "Overdue tetap tampil. Selesai setelah eviden diunggah", tombol "Selesaikan event" yang nonaktif tanpa eviden. Selesai: baca saja dengan "Diselesaikan oleh {nama} pada {tanggal}" dan "Terlambat" bila perlu.

- [ ] **Step 1: Tes gagal**: memilih file mengirim `POST` `FormData` dengan kolom `file` dan daftar bertambah; berkas lebih dari 10 MB ditolak di klien dengan "Berkas terlalu besar. Maksimal 10 MB." tanpa memanggil API; pesan galat API (tipe tidak didukung) tampil; "Selesaikan event" nonaktif saat 0 eviden dan aktif saat ada; klik mengirim `complete` dan menampilkan "Event diselesaikan"; event selesai tidak menampilkan tombol unggah, hapus, atau selesaikan; Manager dan Auditor melihat eviden tanpa tombol aksi; event mendatang menampilkan "Belum waktunya" tanpa tombol; hapus memanggil `DELETE` dan menghilangkan baris; 404 menampilkan "Event tidak ditemukan." dengan tautan kembali ke Kalender.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi. Setelah tiap aksi muat ulang detail. Tombol dengan ikon punya `aria-label`.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): eksekusi event dan unggah eviden`.

### Task 8: Web: Atur jadwal

**Files:**
- Create: `apps/web/src/screens/AturJadwal.tsx`
- Test: `apps/web/src/screens/AturJadwal.test.tsx`

**Interfaces:**
- Consumes: `GET /schedules?all=1`, `POST /schedules`, `PATCH /schedules/:id`, `POST /schedules/:id/stop`, `GET /ponds?all=1`, `GET /users`.
- Produces: daftar jadwal (judul, frekuensi, pond atau "Semua lokasi", tanggal mulai, chip Aktif atau Berhenti), tombol "Tambah jadwal" dan ubah, formulir (judul, deskripsi, frekuensi, tanggal mulai default hari ini, pond, ditugaskan ke) yang mengunci frekuensi dan tanggal mulai dengan keterangan "Terkunci karena sudah ada catatan" bila `locked`, tombol "Hentikan jadwal" dengan konfirmasi.

- [ ] **Step 1: Tes gagal**: tambah jadwal mengirim `POST /api/schedules` dengan nilai formulir; tanggal mulai default hari ini; jadwal `locked` memberi kolom frekuensi dan tanggal mulai `disabled` dengan keterangan; hentikan meminta konfirmasi lalu `POST .../stop`; galat API 409 tampil; Operator membuka `/kalender/jadwal` dialihkan ke Beranda; jadwal berhenti memakai chip "Berhenti" dan tanpa tombol hentikan.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): atur jadwal event`.

### Task 9: Web: Riwayat sebagai tabel

**Files:**
- Create: `apps/web/src/ui/DataTable.tsx`
- Modify: `apps/web/src/screens/Riwayat.tsx` (tulis ulang), `apps/web/src/styles/ui.css`
- Test: `apps/web/src/ui/DataTable.test.tsx`, `apps/web/src/screens/Riwayat.test.tsx` (diperbarui)

**Interfaces:**
- Produces:
  - `DataTable<Row>({ caption, columns, rows, rowKey, pageSize?, emptyText })` dengan `columns: { key: string; header: string; align?: 'left'|'right'; render: (row: Row) => ReactNode; sticky?: boolean }[]`; `<table>` dengan `caption`, `th scope="col"`, wadah yang bisa digulir (`tabindex="0"` dan `role="region"` berlabel), kolom `sticky` menempel kiri, "Tampilkan lebih banyak" menambah `pageSize` baris (default 50).
  - Riwayat: kontrol tiga pilihan "Air permukaan", "Cuaca", "Koagulan"; kolom per pilihan sesuai spec bagian 7; sel outlet di luar baku mutu pond berkelas `is-bad`; sel Sisa dengan selisih berisi "Selisih"; kolom aksi dengan tautan ikon pensil `aria-label="Ubah {tanggal} {pond}"` ke `/input/{modul}?date=&sp=` hanya untuk Operator dan Admin.

- [ ] **Step 1: Tes gagal**: `DataTable` merender caption, header, dan hanya 50 baris pertama dari 120 dengan tombol "Tampilkan lebih banyak" yang menampilkan 50 berikutnya; `emptyText` tampil tanpa baris; kolom sticky punya kelas `is-sticky`; wadah punya nama aksesibel. Riwayat: tab "Air permukaan" menampilkan pH outlet 5,2 dengan kelas `is-bad` sementara pH inlet 3 tidak, dan TSS 38 tidak; debit berformat id-ID (`1.278,7`); tab "Cuaca" menampilkan satu baris per tanggal (bukan per pond) dengan Rainfall dan Rain hours; tab "Koagulan" menampilkan satu baris per jenis dengan "Selisih" pada baris `staleRemaining`; Operator melihat tautan "Ubah 2 Nov 2026 SP-02 Pit Selatan" menuju `/input/air?date=2026-11-02&sp=p1`, Auditor dan Manager tidak; pond nonaktif tetap tampil di riwayat; "Tidak ada data pada rentang ini." dan galat tetap.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi. Gabungkan data `/history` per tab di klien. Hapus gaya kartu riwayat lama.
- [ ] **Step 4:** Jalankan `npm test` dari akar dan `npx tsc --noEmit -p apps/web`. Expected: semua PASS.
- [ ] **Step 5:** Commit `feat(web): Riwayat sebagai tabel`.

### Task 10: Verifikasi, README, laporan Delivery Gate

**Files:**
- Modify: `README.md`, `anti-slop/delivery-gate-2026-11-02.md` (tambah bagian Kalender dan Riwayat)

**Interfaces:**
- Produces: laporan PASS/FAIL dengan bukti per butir untuk layar baru.

- [ ] **Step 1:** Jalankan `npm test`, `npx tsc --noEmit -p apps/web`, `npm run build -w @evo/web`. Expected: semua lulus.
- [ ] **Step 2:** Terapkan migrasi 0003 lokal, jalankan `wrangler dev`, dan lewat `curl` buat jadwal sebagai Manager, unggah JPEG nyata sebagai Operator (cek tersimpan di R2 lokal), selesaikan, unduh sebagai Auditor, dan cek bahwa Manager tidak bisa unggah.
- [ ] **Step 3:** Ambil screenshot Chrome headless 360px dan 1200px untuk Kalender, Eksekusi event, Atur jadwal, Riwayat tiga tab; ukur overflow horizontal dan target sentuh.
- [ ] **Step 4:** Perbarui README (tab Kalender, `wrangler r2 bucket create evo-evidence` untuk deploy) dan laporan Delivery Gate.
- [ ] **Step 5:** Commit `docs: verifikasi Kalender dan Riwayat tabel`.
