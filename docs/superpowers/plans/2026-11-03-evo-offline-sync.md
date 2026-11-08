# ENVIRO Antrean Luring dan Sinkronisasi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operator bisa menyimpan cuaca, air, koagulan, foto eviden, dan menyelesaikan event tanpa sinyal; semuanya terantre di HP dan terunggah otomatis, dengan aturan "yang terakhir dicatat menang".

**Architecture:** Antrean di IndexedDB (`lib/outbox`) dan mesin sinkron di dalam aplikasi (bukan Background Sync). Tulis data membawa `recorded_at` (jam HP); server menimpa hanya bila tidak lebih lama dari yang tersimpan. Eviden membawa `client_id` agar kirim ulang tidak ganda. Service worker menyimpan GET `/day`, `/ponds`, `/events`, `/auth/me` (jaringan dulu) agar layar input terbuka offline.

**Tech Stack:** Hono + D1 (API, Vitest pool workers), React 18 + Vite PWA + Workbox (`vite-plugin-pwa`), IndexedDB, `fake-indexeddb` (tes), Vitest 4 + RTL jsdom.

**Spec:** `docs/superpowers/specs/2026-11-03-evo-offline-sync-design.md`

## Global Constraints

- Bahasa antarmuka Indonesia; tanpa tanda pisah em dash; pesan galat berbahasa Indonesia.
- Dua jenis hasil simpan dibedakan jelas: terkirim ("Data cuaca tersimpan") dan terantre ("Tersimpan di HP, menunggu sinyal"); terantre bukan galat (tanpa warna merah).
- Hanya galat jaringan (`ApiError.status === 0`) dan 401 yang masuk antrean; 4xx lain ditampilkan seperti sekarang dan tidak diantre.
- Waktu dicatat: `new Date().toISOString()` saat pengguna menekan simpan atau memotret; server membatasi nilai lebih dari 5 menit di masa depan ke jam server.
- Tanpa `recorded_at` server berperilaku seperti sekarang (selalu menimpa) dan `client_ts` diisi jam server.
- `POST /complete` kedua membalas 409 "Event ini sudah selesai." (diterima sebagai berhasil oleh klien); `POST /evidence` pada event selesai membalas 409 "Event sudah selesai. Eviden tidak bisa diubah." (item dibuang sebagai usang).
- Antrean milik pengguna: hanya item dengan `owner` = id pengguna yang sedang masuk yang dikirim atau ditampilkan; keluar akun tidak menghapus antrean.
- Target sentuh minimal 44 px, status bukan hanya warna, fokus terlihat; palet Figma tidak diubah.
- Unggah hanya berjalan saat aplikasi terbuka; tes HP sungguhan baru setelah deploy HTTPS dan hanya dengan izin pemilik. Jangan deploy ke akun Cloudflare pengguna, jangan hentikan `wrangler dev` di 8787 (uji di 8799).

## Review Focus

1. HP dipakai bergantian: item milik pengguna lain tidak terkirim, tidak tampil, dan tidak hilang.
2. IndexedDB tidak tersedia atau penuh: simpan ditolak dengan pesan jelas, data tidak hilang diam-diam; tanpa IndexedDB perilaku lama (butuh koneksi).
3. "Selesaikan event" tidak boleh terkirim sebelum semua fotonya terunggah; 409 "sudah selesai" dianggap berhasil; foto ke event yang sudah selesai dibuang dengan pemberitahuan, bukan macet selamanya.
4. Simpan berulang untuk kunci yang sama saat offline: hanya yang terbaru terkirim; item `failed` tidak tertimpa diam-diam.
5. Jam HP: `recorded_at` di masa depan dibatasi; format tak sah ditolak 400; klien lama tanpa `recorded_at` tetap menimpa.
6. Dua putaran sinkron bersamaan (dua tab, pemicu ganda): tidak ada eviden ganda dan tidak ada kirim ganda.
7. Sesi habis (401) di tengah antrean: antrean dijeda tanpa kehilangan, dan lanjut setelah masuk lagi.

---

### Task 1: API waktu dicatat (`recorded_at`) dan migrasi

**Files:**
- Create: `apps/api/migrations/0005_offline.sql`, `apps/api/test/offline-recorded.test.ts`
- Modify: `apps/api/src/entries/common.ts`, `weather.ts`, `water.ts`, `coagulant.ts`

**Interfaces:**
- Produces:
  - Migrasi: `weather.client_ts`, `surface_water.client_ts`, `coagulant.client_ts` (TEXT, NULL boleh), `evidences.client_id` (TEXT) dengan indeks unik parsial `idx_evidences_client_id ON evidences(client_id) WHERE client_id IS NOT NULL`.
  - `readRecordedAt(c: Context<AppEnv>, body: Record<string, unknown>, now?: number): { iso: string; explicit: boolean } | Fail` di `common.ts`. Tanpa `recorded_at`: `{ iso: jam server, explicit: false }`. Ada tetapi bukan ISO yang bisa di-`Date.parse`: `Fail` 400 `"Waktu pencatatan tidak sah."`. Lebih dari `now + 5 menit`: dibatasi ke `now`.
  - Tiga rute PUT menerima `recorded_at` di badan; `INSERT ... ON CONFLICT DO UPDATE` mengisi `client_ts`; bila `explicit`, klausa `WHERE client_ts IS NULL OR excluded.client_ts >= client_ts` pada DO UPDATE; `applied = res.meta.changes > 0` (selalu `true` bila tidak explicit). Respons lama ditambah `applied: boolean`. Respons `applied: false` tetap status 200.

- [ ] **Step 1: Tes gagal** `offline-recorded.test.ts` (pakai `login`, `addPond`, `call`, `json` dari `helpers.ts`; Operator): untuk cuaca, air, dan koagulan masing-masing: (a) PUT dengan `recorded_at: '2026-11-02T08:00:00Z'` lalu PUT dengan `'2026-11-02T07:00:00Z'` dan nilai lain = `applied: false`, nilai tersimpan tetap yang pertama; (b) `recorded_at` sama atau lebih baru menimpa dengan `applied: true`; (c) PUT tanpa `recorded_at` setelah item ber-`recorded_at` selalu menimpa; (d) `recorded_at: '2999-01-01T00:00:00Z'` diterima dan `client_ts` tersimpan <= jam server + 5 menit (baca lewat `env.DB`); (e) `recorded_at: 'kemarin'` = 400 `Waktu pencatatan tidak sah.`; (f) koagulan: dua item `recorded_at` urut terbalik tidak mengubah `stock_remaining` item yang menang; (g) respons memuat `applied`.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api -- offline-recorded`. Expected: FAIL.
- [ ] **Step 3:** Tulis migrasi dan `readRecordedAt`; ubah tiga rute (variabel `where` ditempel ke SQL hanya saat `explicit`).
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS (semua, termasuk tes lama).
- [ ] **Step 5:** Commit `feat(api): waktu dicatat untuk simpan data (recorded_at)`.

### Task 2: API eviden idempoten (`client_id`)

**Files:**
- Modify: `apps/api/src/events/evidence.ts`
- Test: `apps/api/test/evidence-client-id.test.ts`

**Interfaces:**
- Consumes: kolom `evidences.client_id` dari Task 1.
- Produces: `POST /events/:scheduleId/:date/evidence` menerima field form `client_id` (`/^[A-Za-z0-9-]{8,64}$/`, selain itu 400 `"ID unggahan tidak sah."`). Bila sudah ada baris dengan `client_id` yang sama dan `uploaded_by` pengguna yang sama: balas `200` dengan bentuk yang sama seperti `201` (`id, filename, mime, size, source, gps_*, taken_at` dari baris itu), tanpa berkas R2 baru. Bila `client_id` milik pengguna lain: 409 `"ID unggahan sudah dipakai."`. Tabrakan indeks unik saat dua permintaan serentak: hapus berkas R2 yang baru dan balas baris yang menang.

- [ ] **Step 1: Tes gagal** (tiru pembantu unggah di `evidence.test.ts` yang sudah ada): unggah dua kali dengan `client_id` sama = status 201 lalu 200, `id` sama, satu baris di `evidences`, satu objek di R2; tanpa `client_id` unggahan lama tetap membuat baris baru; `client_id: 'x'` = 400; `client_id` pengguna lain = 409; dua unggahan serentak (`Promise.all`) dengan `client_id` sama menghasilkan satu baris; `POST /complete` dua kali = 200 lalu 409 `Event ini sudah selesai.` dan satu baris `event_completions`.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api -- evidence-client-id`. Expected: FAIL.
- [ ] **Step 3:** Implementasi di `evidence.ts` (baca `client_id` dari form sebelum menyentuh R2; simpan di `INSERT`).
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): unggah eviden idempoten lewat client_id`.

### Task 3: Penyimpanan antrean (IndexedDB)

**Files:**
- Create: `apps/web/src/lib/outbox/db.ts`, `apps/web/src/lib/outbox/queue.ts`
- Modify: `apps/web/package.json` (devDependency `fake-indexeddb`), `apps/web/src/test-setup.ts` (`import 'fake-indexeddb/auto'`)
- Test: `apps/web/src/lib/outbox/queue.test.ts`

**Interfaces:**
- Produces (`db.ts`):
  - `type OutboxKind = 'weather' | 'water' | 'coagulant' | 'evidence' | 'complete'`
  - `type OutboxRequest = { method: 'PUT' | 'POST'; path: string; body?: Record<string, unknown>; fields?: Record<string, string>; filename?: string }`
  - `type OutboxItem = { id: string; owner: string; kind: OutboxKind; key: string; group: string | null; label: string; request: OutboxRequest; blob: Blob | null; recordedAt: string; seq: number; status: 'pending' | 'failed'; error: string | null; tries: number; nextAt: number }`
  - `outboxAvailable(): boolean` (`typeof indexedDB !== 'undefined'`); basis data `evo-outbox` versi 1, store `items` (keyPath `id`, indeks `owner`); fungsi tipis `allItems(): Promise<OutboxItem[]>`, `putItem(i)`, `deleteItem(id)`.
- Produces (`queue.ts`):
  - `enqueue(i: { owner: string; kind: OutboxKind; key: string; group?: string | null; label: string; request: OutboxRequest; blob?: Blob | null; recordedAt?: string }): Promise<OutboxItem>`: `seq` = maksimum + 1; item `pending` dengan `owner` dan `key` sama digantikan (dihapus); item `failed` tidak disentuh; galat penulisan dilempar sebagai `Error('Tidak bisa menyimpan di HP. Ruang penyimpanan penuh atau diblokir.')`.
  - `listItems(owner: string): Promise<OutboxItem[]>` (menaik menurut `seq`), `removeItem(id)`, `markFailed(id, error)`, `retryItem(id)` (`pending`, `tries` 0, `nextAt` 0, `error` null), `scheduleRetry(id, nextAt: number)` (`tries + 1`), `removePending(owner, key)`.
  - `subscribe(fn: () => void): () => void`: dipanggil setelah tiap perubahan, juga dari tab lain lewat `BroadcastChannel('evo-outbox')` bila ada.

- [ ] **Step 1: Tes gagal** `queue.test.ts`: `enqueue` mengisi `seq` naik dan `status: 'pending'`; kunci sama dan `pending` = digantikan (satu item, `seq` baru, `recordedAt` baru); kunci sama dan `failed` = dua item; kunci sama pemilik lain = dua item; `listItems` hanya milik `owner` dan terurut; `markFailed` lalu `retryItem` mengembalikan `pending`; `scheduleRetry` menaikkan `tries` dan mengisi `nextAt`; `removePending` hanya menghapus `pending`; `subscribe` dipanggil sekali per perubahan dan berhenti setelah unsubscribe; `Blob` tersimpan dan terbaca ulang (ukuran sama); `enqueue` yang gagal menulis (`putItem` ditolak lewat `vi.spyOn`) menolak dengan pesan di atas dan tidak mengubah isi.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- outbox/queue`. Expected: FAIL.
- [ ] **Step 3:** Implementasi (`db.ts` membungkus `indexedDB.open` dengan promise; satu koneksi dipakai ulang).
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS (tes lama tetap hijau dengan `fake-indexeddb` global).
- [ ] **Step 5:** Commit `feat(web): penyimpanan antrean IndexedDB`.

### Task 4: Mesin sinkron

**Files:**
- Create: `apps/web/src/lib/outbox/sync.ts`
- Test: `apps/web/src/lib/outbox/sync.test.ts`

**Interfaces:**
- Consumes: `queue.ts`, `db.ts` (Task 3), `api`, `ApiError` (`api/client.ts`).
- Produces:
  - `type SyncResult = { sent: number; failed: number; remaining: number; paused: 'auth' | null }`
  - `runSync(owner: string, now?: number): Promise<SyncResult>`: satu putaran pada satu waktu (panggilan serentak mengembalikan promise yang sama; juga `navigator.locks.request('evo-outbox-sync', { ifAvailable: true }, ...)` bila tersedia). Mengirim item `pending` milik `owner` menurut `seq` yang `nextAt <= now`. Pengiriman: `PUT/POST` JSON dengan badan + `recorded_at: item.recordedAt` (untuk `weather|water|coagulant`); `evidence` = `FormData` (`file` dari `blob`+`filename`, semua `fields`, `client_id: item.id`); `complete` = `POST` tanpa badan. Hasil: sukses atau balasan `applied === false` = hapus item (dihitung `sent`); `complete` dengan 409 `Event ini sudah selesai.` = hapus; `evidence` dengan 409 `Event sudah selesai. Eviden tidak bisa diubah.` = hapus; status 0 = jadwalkan ulang item dan **hentikan putaran**; status >= 500 = `scheduleRetry` dengan jeda `[5, 15, 60, 300, 300, ...]` detik menurut `tries` dan lanjut ke item grup lain; 401 = hentikan dengan `paused: 'auth'` tanpa mengubah item; 4xx lain = `markFailed(id, pesan server)`. `complete` dilewati selama masih ada item `evidence` (status apa pun) dengan `group` sama. Setelah putaran dengan `sent > 0` dan `remaining === 0`: `window.dispatchEvent(new Event('outbox:drained'))`.
  - `startSync(getOwner: () => string | null): () => void`: menjalankan `runSync` saat dipanggil, saat `online`, `visibilitychange` ke `visible`, setiap 30 detik, dan setiap `subscribe` (digabung per microtask); mengembalikan fungsi pembersih.

- [ ] **Step 1: Tes gagal** `sync.test.ts` (`fetch` ditiru; item dibuat lewat `enqueue`): sukses menghapus item dan mengirim `recorded_at`; `applied: false` menghapus tanpa galat; status 0 menghentikan putaran (item kedua tidak dikirim) dan menaikkan `tries`; 500 menunda dengan `nextAt = now + 5000` lalu 15000 pada percobaan berikutnya, item grup lain tetap dikirim; 401 = `paused: 'auth'` dan seluruh item tetap `pending`; 400 = `failed` dengan pesan server dan tidak dikirim ulang pada putaran berikutnya; `complete` menunggu `evidence` sejadwalnya (dan terkirim sesudahnya dalam putaran yang sama setelah `evidence` sukses); `complete` 409 "sudah selesai" dihapus; `evidence` 409 terkunci dihapus; `evidence` terkirim dengan `client_id` = id item dan berkas sesuai; item pemilik lain tidak disentuh; dua `runSync` serentak mengirim tiap item sekali; `outbox:drained` ditembakkan setelah antrean kosong; `startSync` memicu pada `online` dan berhenti setelah pembersih.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- outbox/sync`. Expected: FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): mesin sinkron antrean`.

### Task 5: `saveEntry`, tumpang tindih data tertunda, dan layar input

**Files:**
- Create: `apps/web/src/lib/outbox/save.ts`, `apps/web/src/lib/outbox/overlay.ts`, `apps/web/src/hooks/useOutbox.ts`
- Modify: `apps/web/src/hooks/useDay.ts`, `apps/web/src/screens/InputCuaca.tsx`, `InputAir.tsx`, `InputKoagulan.tsx`, `apps/web/src/api/client.ts` (ekspor `isNetworkError(e)`), `apps/web/src/App.tsx` (memanggil `startSync`)
- Test: `apps/web/src/lib/outbox/save.test.ts`, `overlay.test.ts`, perbarui `apps/web/src/screens/InputForms.test.tsx`

**Interfaces:**
- Consumes: Task 3 dan 4.
- Produces:
  - `isNetworkError(e: unknown): boolean` = `e instanceof ApiError && (e.status === 0 || e.status === 401)`.
  - `saveEntry(o: { owner: string; kind: 'weather' | 'water' | 'coagulant'; key: string; label: string; path: string; body: Record<string, unknown> }): Promise<{ queued: boolean }>`: kirim `PUT` dengan `recorded_at`; sukses = `removePending(owner, key)` lalu `{ queued: false }`; `isNetworkError` dan `outboxAvailable()` = `enqueue` lalu `{ queued: true }`; lainnya melempar ulang.
  - `applyPending(data: DayData, items: OutboxItem[], date: string, sp: string): DayData` (murni): menimpa `weather`, `water`, dan `coagulant[type]` dengan isi item `pending` kunci `weather|{date}`, `water|{date}|{sp}`, `coagulant|{date}|{sp}|{type}`; sisa stok yang tidak diisi dihitung `defaultRemaining(previousRemaining[type], in, out)`; tidak mengubah objek asal.
  - `useOutbox(): { items: OutboxItem[]; pending: number; failed: number }` milik pengguna yang masuk; berlangganan `subscribe`.
  - `useDay` mengembalikan `data` yang sudah melewati `applyPending` (memakai `useOutbox`).
  - `App` memanggil `startSync(() => user?.id ?? null)` di `useEffect` saat `user` ada.

- [ ] **Step 1: Tes gagal.** `save.test.ts`: online sukses = `queued: false` dan item `pending` sekunci dihapus; `fetch` melempar jaringan = `queued: true` dan satu item dengan `recordedAt` ISO; 401 = antre; 400 = melempar `ApiError` dan antrean kosong; IndexedDB tidak tersedia (`vi.stubGlobal('indexedDB', undefined)`) = melempar galat jaringan seperti semula; `enqueue` gagal = melempar pesan "Tidak bisa menyimpan di HP...". `overlay.test.ts`: cuaca, air, dan koagulan tertunda menimpa nilai server; hanya kunci yang cocok tanggal dan pond; sisa stok dihitung; item `failed` tidak ikut; masukan tidak berubah. `InputForms.test.tsx`: offline (`fetch` melempar) menampilkan toast "Tersimpan di HP, menunggu sinyal" untuk Cuaca, Air, Koagulan, form tetap berisi angka, tidak ada alert merah; membuka layar lagi (offline dengan `/day` kosong) menampilkan angka tertunda; 400 dari server tetap menampilkan pesannya dan tidak mengantre.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- outbox/save outbox/overlay InputForms`. Expected: FAIL.
- [ ] **Step 3:** Implementasi. Di tiga layar, ganti `put(...)` dengan `saveEntry` (owner = `useAuth().user.id`, label mis. "Cuaca 2 Nov", kunci sesuai bagian 3 spesifikasi); bila `queued`, toast terantre dan **tanpa** `reload()`.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): simpan input ke antrean saat offline`.

### Task 6: Eviden dan selesaikan event offline

**Files:**
- Modify: `apps/web/src/lib/outbox/save.ts`, `apps/web/src/screens/EventDetail.tsx`
- Test: `apps/web/src/lib/outbox/save.test.ts` (tambah), `apps/web/src/screens/EventDetail.test.tsx` (tambah)

**Interfaces:**
- Consumes: Task 5.
- Produces:
  - `saveEvidence(o: { owner: string; scheduleId: string; date: string; label: string; file: File; fields: Record<string, string> }): Promise<{ queued: boolean }>`: kirim `FormData` (`file`, `fields`, `client_id` = uuid baru); `isNetworkError` = `enqueue({ kind: 'evidence', key: 'evidence|{scheduleId}|{date}|{uuid}', group: '{scheduleId}|{date}', request: { method: 'POST', path, fields, filename }, blob: file })` dengan **id item = uuid yang sama dengan `client_id`**.
  - `completeEvent(o: { owner: string; scheduleId: string; date: string; label: string }): Promise<{ queued: boolean }>`: `POST /complete`; `isNetworkError` = `enqueue({ kind: 'complete', key: 'complete|{scheduleId}|{date}', group: '{scheduleId}|{date}', ... })`.
  - `EventDetail`: `send` memakai `saveEvidence`; foto kamera yang terantre dianggap berhasil (kamera menutup, toast "Foto tersimpan di HP, menunggu sinyal"); daftar eviden menampilkan item antrean sejadwal dan tanggal dengan lencana "Menunggu unggah"; tombol "Selesaikan event" aktif bila `evidences.length + terantre > 0` dan memakai `completeEvent`; setelah `outbox:drained` memuat ulang detail.

- [ ] **Step 1: Tes gagal.** `save.test.ts`: `saveEvidence` online mengirim `client_id` dan `source`; offline menyimpan blob, `group`, dan id item sama dengan `client_id` yang akan dikirim (diverifikasi lewat `runSync` dengan `fetch` tiruan); `completeEvent` offline menyimpan item `complete` dan hanya terkirim setelah `evidence` sejadwalnya (urutan panggilan `fetch`). `EventDetail.test.tsx`: offline, memilih berkas menampilkan toast terantre dan baris "Menunggu unggah"; tombol Selesaikan aktif dengan hanya foto terantre dan menampilkan toast terantre saat ditekan; foto kamera offline menutup kamera; setelah `outbox:drained` detail dimuat ulang.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- outbox/save EventDetail`. Expected: FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): eviden dan penyelesaian event lewat antrean`.

### Task 7: Chip sinkron, daftar antrean, keluar akun, cache baca

**Files:**
- Create: `apps/web/src/ui/SyncChip.tsx`, `apps/web/src/components/OutboxSheet.tsx`, `apps/web/src/ui/SyncChip.test.tsx`
- Modify: `apps/web/src/App.tsx` (ganti `ConnectionChip`; hapus `ui/ConnectionChip.tsx`), `apps/web/src/auth/AuthContext.tsx`, `apps/web/src/screens/Akun.tsx`, `apps/web/src/styles/ui.css`, `apps/web/vite.config.ts`, `apps/web/src/screens/Login.tsx`

**Interfaces:**
- Consumes: `useOutbox`, `listItems`, `retryItem`, `removeItem`, `runSync` (Task 3 sampai 5).
- Produces:
  - `SyncChip`: offline tanpa antrean "Tidak ada koneksi"; offline dengan antrean "Tidak ada koneksi - 3 menunggu"; online dengan antrean "Mengunggah 3…"; ada item `failed`: tombol "1 gagal" (selalu bisa ditekan); tanpa antrean dan online: tidak tampil. Tombol membuka `OutboxSheet`.
  - `OutboxSheet({ onClose })`: `role="dialog"`, Escape menutup, daftar item (label, status teks "Menunggu" atau "Gagal", pesan galat), tombol "Coba lagi" (`retryItem` lalu `runSync`) dan "Buang" (konfirmasi yang menyebut label data yang hilang).
  - `AuthContext.logout()`: setelah `post('/auth/logout')`, `caches.delete('evo-api')` (dibungkus try/catch); tidak menyentuh antrean. `Akun.tsx`: bila `pending + failed > 0`, "Keluar" membuka konfirmasi "Ada N data belum terunggah. Keluar akan menyimpannya di HP sampai Anda masuk lagi." sebelum `logout`.
  - `Login`: bila ada item antrean milik siapa pun di HP ini (`allItems()` tidak kosong), tampil catatan "Ada N data belum terunggah di HP ini. Masuk dengan akun pemiliknya untuk mengunggah." (sesi habis sehingga `App` menampilkan `Login` adalah jalur 401 mid-antrean).
  - `vite.config.ts`: `workbox.runtimeCaching = [{ urlPattern: ({ url }) => /^\/api\/(day|ponds|events|auth\/me)/.test(url.pathname), handler: 'NetworkFirst', options: { cacheName: 'evo-api', networkTimeoutSeconds: 3, expiration: { maxEntries: 60, maxAgeSeconds: 14 * 24 * 3600 }, cacheableResponse: { statuses: [200] } } }]`.

- [ ] **Step 1: Tes gagal** `SyncChip.test.tsx` dan tambahan di `Akun`/`ui.test`: teks keempat keadaan chip; chip tersembunyi saat online tanpa antrean; tombol "1 gagal" membuka daftar; "Coba lagi" memanggil sinkron dan "Buang" meminta konfirmasi dulu; Escape menutup; target tombol >= 44 px (`min-height` pada kelas); "Keluar" dengan antrean menampilkan konfirmasi dan "Batal" tidak keluar; tanpa antrean langsung keluar; `logout` memanggil `caches.delete('evo-api')` (stub `caches`) dan tidak menghapus item antrean.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web -- SyncChip Akun ui`. Expected: FAIL.
- [ ] **Step 3:** Implementasi, termasuk gaya (`.ui-sync`, `.ui-outbox`) mengikuti token yang ada dan konfigurasi Workbox.
- [ ] **Step 4:** Jalankan `npm test` dari akar, `npx tsc --noEmit -p apps/web`, dan `npm run build -w @evo/web`; pastikan `dist/sw.js` memuat `evo-api`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): chip sinkron, daftar antrean, cache baca offline`.

### Task 8: Verifikasi nyata dan dokumen

**Files:**
- Modify: `apps/web/src/lib/outbox/queue.ts` (minta `navigator.storage.persist()` saat item pertama dibuat, dibungkus try/catch, dengan satu tes kecil di `queue.test.ts`), `README.md`, `anti-slop/delivery-gate-2026-11-02.md`
- Create: skrip CDP di folder scratchpad (bukan di repo)

- [ ] **Step 1:** Jalankan `npm test`, `npx tsc --noEmit -p apps/web`, `npm run build -w @evo/web`. Expected: lulus.
- [ ] **Step 2:** Jalankan `cd apps/api && npx wrangler d1 migrations apply evo --local` lalu `npx wrangler dev --port 8799` (jangan hentikan 8787). Pakai pond uji `SP 11` yang sudah ada.
- [ ] **Step 3:** Di Chrome nyata (skrip CDP seperti `laporan.mjs`; `Network.emulateNetworkConditions` offline; kamera tiruan `--use-fake-device-for-media-stream`), sebagai Operator: (a) buka layar Cuaca, Air, Koagulan sekali online agar cache terisi; (b) offline: isi dan simpan ketiganya, periksa toast terantre, chip "menunggu", dan angka muncul lagi setelah muat ulang halaman; (c) potret foto di Eksekusi event dan tekan Selesaikan saat offline; (d) tutup dan buka lagi aplikasi (tab baru) dan pastikan antrean masih ada; (e) nyalakan jaringan: semua terunggah, chip hilang, event selesai dengan satu eviden, tanpa ganda (periksa lewat API); (f) edit lebih baru lewat `curl` sebelum antrean terunggah: nilai yang lebih baru tidak tertimpa; (g) pengguna lain masuk di profil yang sama dengan antrean milik Operator: antrean tidak tampil dan tidak terkirim; (h) keluar akun dengan antrean menampilkan konfirmasi. Catat hasil dan perbaiki selisih nyata.
- [ ] **Step 4:** Perbarui README (hapus "Offline data queue" dari "Not in this version", tambah bagian "Mode luring": apa yang diantre, aturan konflik, batas: unggah hanya saat aplikasi terbuka, jam HP) dan laporan Delivery Gate (bukti, temuan yang diperbaiki, belum diuji: HP sungguhan).
- [ ] **Step 5:** Commit `docs: verifikasi antrean luring`.
