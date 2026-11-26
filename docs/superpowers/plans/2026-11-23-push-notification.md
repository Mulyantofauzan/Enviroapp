# Push notification (PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, never subagent-driven per user memory). Steps use checkbox syntax.

**Goal:** Kirim Web Push untuk pemantauan belum diisi, pengingat event kalender, dan hasil di luar baku mutu.

**Architecture:** Worker mengirim Web Push (VAPID) memakai `@block65/webcrypto-web-push` (WebCrypto, jalan di Workers). Pemilih penerima/isi pesan adalah fungsi murni; pengirim dibungkus `sendToUsers` yang membaca `push_subscriptions`, menulis `notification_log` untuk dedup, dan menghapus langganan 404/410. `scheduled()` memilih tugas dari `event.cron`. Sisi web: service worker (`importScripts`) menangani `push` dan `notificationclick`; layar Akun punya tombol aktif/matikan.

**Tech Stack:** Hono, D1, Cloudflare cron, `@block65/webcrypto-web-push`, vite-plugin-pwa (workbox `importScripts`), React, vitest (workers pool di API, jsdom di web).

**Spec:** `docs/superpowers/specs/2026-11-23-push-notification-design.md`

## Global Constraints

- Waktu WITA (UTC+8): cron `0 23 * * *` = 07.00, `0 8 * * *` = 16.00; `0 18 * * *` (backup) tetap.
- Penerima 3.1 dan 3.2: pengguna `is_active=1` berperan Operator atau Admin. Penerima 3.3: Admin aktif.
- Cron digabung satu pesan per penerima. Teks Indonesia.
- Secret: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (kunci privat mentah base64url), `VAPID_SUBJECT`.
- Hari no flow (`isNoFlow(debit_outlet_m3s)`) tidak dihitung pelanggaran. Nilai null tidak pelanggaran (`isOutOfLimit`).
- Dedup 3.3: sekali per pond, tanggal, parameter (kunci `limit|date|sp|key|user`).
- Push gagal tidak boleh menggagalkan `PUT /water` (dibungkus `ctx.waitUntil`/try-catch).

## Review Focus

- Cron berjalan dua kali di hari sama: tidak ada notifikasi ganda (tes dedup).
- Data air disimpan ulang dengan nilai tetap melanggar: tidak kirim lagi.
- Langganan kedaluwarsa (410): dihapus, pengiriman ke langganan lain tetap jalan.
- Pengguna nonaktif / Manager / Auditor tidak menerima apa pun.
- Pengguna keluar akun di HP bersama: langganan perangkat itu dihapus.

---

### Task 1: Migrasi, tipe, dan pemilih murni

**Files:**
- Create: `apps/api/migrations/0008_push.sql`, `apps/api/src/push/select.ts`, `apps/api/test/push-select.test.ts`
- Modify: `apps/api/src/types.ts`, `apps/api/test/setup.ts` (hapus `push_subscriptions`, `notification_log` tiap tes)

**Interfaces:**
- Produces (`select.ts`):
  - `type Msg = { title: string; body: string; url: string; tag: string }`
  - `monitoringMessage(missingWater: string[], missingWeather: boolean): Msg | null`
  - `eventsMessage(kind: 'soon'|'due'|'overdue', titles: string[]): Msg | null`
  - `limitMessage(pond: string, key: 'ph_outlet'|'tss_outlet', value: number, t: {min:number|null;max:number|null}): Msg`

- [ ] **Step 1: Tes** (`push-select.test.ts`): `monitoringMessage([], false)` → null; `(['SP 11 LGG'], true).body` = `Belum diisi hari ini: SP 11 LGG (air), cuaca.`; `([], true).body` = `Belum diisi hari ini: cuaca.`; url `/input`. `eventsMessage('due', [])` → null; satu judul → body memuat judul; 4 judul → body `4 event: A, B, dan 2 lainnya.`; url `/kalender`. `limitMessage('SP 11 LGG','tss_outlet',52,{min:null,max:40}).body` = `SP 11 LGG: TSS outlet 52 mg/L di atas baku mutu (maks. 40).`; pH di bawah min → `pH outlet 5.2 di bawah baku mutu (min. 6).`; url `/`. Format angka pakai `formatNumber` dari `@evo/shared`.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api -- push-select` → FAIL.
- [ ] **Step 3:** Tulis migrasi (`push_subscriptions`, `notification_log` sesuai spec bagian 4), tipe `Env` tambah `VAPID_PUBLIC_KEY?, VAPID_PRIVATE_KEY?, VAPID_SUBJECT?: string`, dan implementasi `select.ts`.
- [ ] **Step 4:** Tes lulus. Commit `feat(api): migrasi push dan pembuat pesan notifikasi`.

### Task 2: Pengirim (`sendToUsers`) dan dedup

**Files:**
- Create: `apps/api/src/push/send.ts`, `apps/api/test/push-send.test.ts`
- Modify: `apps/api/package.json` (dependency `@block65/webcrypto-web-push`)

**Interfaces:**
- Consumes: `Msg`, `Env`.
- Produces: `type Transport = (sub: {endpoint:string;p256dh:string;auth:string}, msg: Msg, env: Env) => Promise<number>` (status HTTP); `defaultTransport: Transport` (pakai `buildPushHTTPRequest` lalu `fetch`); `sendToUsers(env: Env, userIds: string[], msg: Msg, dedupKeyOf: ((userId: string) => string) | null, transport?: Transport): Promise<number>` (jumlah terkirim). Bila `dedupKeyOf` ada: `INSERT OR IGNORE INTO notification_log`, lewati bila sudah ada (changes=0). Status 404/410 → hapus baris langganan.

- [ ] **Step 1: Tes** dengan transport palsu: kirim ke 2 langganan satu pengguna → transport dipanggil 2x; kunci dedup sama dipanggil dua kali → hanya sekali; transport mengembalikan 410 → baris terhapus, langganan lain tetap; pengguna tanpa langganan → 0 kiriman dan tidak error.
- [ ] **Step 2:** Jalankan → FAIL. **Step 3:** `npm i @pushforge/builder -w @evo/api`, implementasi. Dedup dicatat sebelum kirim hanya bila pengguna punya ≥1 langganan.
- [ ] **Step 4:** Lulus. Commit `feat(api): pengirim push dengan dedup dan pembersihan langganan`.

### Task 3: Rute langganan

**Files:**
- Create: `apps/api/src/push/routes.ts`, `apps/api/test/push-routes.test.ts`
- Modify: `apps/api/src/index.ts` (`app.route('/push', pushRoutes)`)

**Interfaces:** `GET /push/key` → `{key}` (publik, auth wajib); `POST /push/subscribe` body `{endpoint, keys:{p256dh,auth}}` → upsert by endpoint (milik pengguna yang login, ganti `user_id` bila endpoint sama), 400 bila bentuk salah; `DELETE /push/subscribe` body `{endpoint}` → hapus baris milik pengguna itu.

- [ ] **Step 1: Tes:** tanpa login 401; subscribe dua kali endpoint sama → 1 baris; endpoint dipindah ke pengguna lain setelah login lain → `user_id` berganti; body tidak valid 400; delete menghapus; delete endpoint milik pengguna lain tidak menghapus.
- [ ] **Step 2–4:** gagal → implementasi → lulus. Commit `feat(api): rute langganan push`.

### Task 4: Tugas cron dan dispatch

**Files:**
- Create: `apps/api/src/push/jobs.ts`, `apps/api/test/push-jobs.test.ts`
- Modify: `apps/api/src/index.ts` (`scheduled` memilih per `event.cron`), `apps/api/wrangler.jsonc` (cron tambahan)

**Interfaces:**
- Produces: `runMonitoringReminder(env, now?: Date, transport?)`, `runEventReminders(env, kind: 'morning'|'afternoon', now?, transport?)`. `scheduled`: `0 23 * * *` → `runEventReminders('morning')`; `0 8 * * *` → `runMonitoringReminder` + `runEventReminders('afternoon')`; `0 18 * * *` → `nightlyBackup`. Jadwal event memakai `dueDates`/`isDueDate` dan `event_completions` seperti `events.ts` (besok = `soon`, hari ini belum selesai = `due` pagi / `overdue` sore).
- Kunci dedup: `monitor|date|user`, `event-soon|date|user`, `event-due|date|user`, `event-overdue|date|user`.

- [ ] **Step 1: Tes** (transport palsu mencatat pesan): pond aktif tanpa data air + tanpa cuaca → Operator dan Admin dapat pesan, Manager/Auditor/nonaktif tidak; semua terisi → tidak kirim; pond nonaktif diabaikan; cron dijalankan dua kali → sekali; event harian jatuh tempo besok → pesan "akan datang" pagi; jatuh tempo hari ini belum selesai → pagi `due`, sore `overdue`; sudah selesai → tidak ada.
- [ ] **Step 2–4:** gagal → implementasi → lulus. Pastikan tanggal "hari ini" dari `todayInSite(now)`.
- [ ] **Step 5:** Commit `feat(api): pengingat pemantauan dan event lewat cron`.

### Task 5: Notifikasi di luar baku mutu saat simpan air

**Files:**
- Modify: `apps/api/src/entries/water.ts`; Create: `apps/api/test/push-limit.test.ts`

**Interfaces:** Setelah upsert dengan `applied` true, di `c.executionCtx.waitUntil` (dibungkus try/catch): ambil `pond_thresholds` pond, tolak bila `isNoFlow(debit_outlet_m3s)`, untuk `ph_outlet` dan `tss_outlet` yang `isOutOfLimit` panggil `sendToUsers(env, adminIds, limitMessage(...), (u) => \`limit|${date}|${sp}|${key}|${u}\`)`. Transport bisa diganti lewat variabel modul `setTransport` di `send.ts` untuk tes.

- [ ] **Step 1: Tes:** TSS 52 dengan max 40 → Admin dapat satu pesan; simpan ulang → tidak ada pesan kedua; nilai dalam batas → tidak ada; debit outlet 0 → tidak ada; `applied` false (data lebih lama) → tidak ada; Operator tidak menerima.
- [ ] **Step 2–4:** gagal → implementasi → lulus (`PUT /water` tetap 200 meski transport melempar). Commit `feat(api): notifikasi hasil di luar baku mutu`.

### Task 6: Service worker dan layar Akun

**Files:**
- Create: `apps/web/public/push-sw.js`, `apps/web/src/lib/push.ts`, `apps/web/src/lib/push.test.ts`
- Modify: `apps/web/vite.config.ts` (`workbox.importScripts: ['push-sw.js']`), `apps/web/src/screens/Akun.tsx` (+ test), `apps/web/src/auth/AuthContext.tsx` (logout memanggil `unsubscribePush`)

**Interfaces (`push.ts`):** `pushSupport(): 'ok'|'unsupported'|'needs-install'` (iOS bukan standalone → `needs-install`); `isSubscribed(): Promise<boolean>`; `enablePush(): Promise<void>` (minta izin, `GET /push/key`, `pushManager.subscribe({userVisibleOnly:true, applicationServerKey})`, `POST /push/subscribe`); `disablePush(): Promise<void>` (DELETE ke server lalu `unsubscribe`); `unsubscribePush()` = aman dipanggil tanpa dukungan.
`push-sw.js`: `push` → `showNotification(title,{body,tag,data:{url}})`; `notificationclick` → tutup, fokuskan klien terbuka dan `navigate(url)` atau `clients.openWindow(url)`.

- [ ] **Step 1: Tes** (`push.test.ts`, `Akun.test.tsx`): `pushSupport` tanpa `PushManager` → `unsupported`; Akun tanpa dukungan menampilkan teks penjelasan dan tanpa tombol; dengan dukungan palsu, klik "Aktifkan notifikasi" memanggil `/api/push/subscribe`; klik "Matikan notifikasi" memanggil DELETE; logout memanggil DELETE bila berlangganan.
- [ ] **Step 2–4:** gagal → implementasi → lulus; `npm run build -w @evo/web` dan pastikan `dist/sw.js` memuat `importScripts('push-sw.js')`.
- [ ] **Step 5:** Commit `feat(web): tombol notifikasi di Akun dan penangan push di service worker`.

### Task 7: Kunci VAPID, verifikasi penuh, dokumentasi

- [ ] **Step 1:** Buat pasangan VAPID (`npx @pushforge/builder vapid` (hanya untuk membuat kunci; publik = x+y mentah, privat = `d``), simpan ke `apps/api/.dev.vars` (sudah di-ignore; cek `.gitignore`), jangan commit. Secret produksi diatur lewat `wrangler secret put` hanya saat user minta deploy.
- [ ] **Step 2:** `npm test` (semua workspace) dan `npm run build -w @evo/web` hijau; `tsc` bersih.
- [ ] **Step 3:** Tambahkan catatan singkat di README/doc soal secret dan iOS Layar Utama. Commit `docs: catatan push notification`.

## Self-Review

Spec 3.1 → Task 4; 3.2 → Task 4; 3.3 → Task 5; data/migrasi → Task 1; API → Task 3; sisi app + logout + SW → Task 6; dedup, 404/410 → Task 2; secret → Task 7. Nama `Msg`, `Transport`, `sendToUsers` konsisten antar task. Deploy, migrasi remote, dan secret produksi tidak dilakukan tanpa permintaan user.
