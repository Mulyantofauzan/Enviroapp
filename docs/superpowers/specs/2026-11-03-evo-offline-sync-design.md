# ENVIRO Bagian 5: Antrean luring dan sinkronisasi otomatis

Memenuhi PRD 3.2 (Mode Luring & Sinkronisasi). Antislop mode "selama bekerja" berlaku.

## 1. Cakupan

**Masuk:** simpan cuaca, air permukaan, koagulan, unggah foto eviden, dan "selesaikan event" saat tanpa koneksi; antrean di HP; unggah otomatis; status dan daftar antrean; cache baca agar layar input terbuka tanpa sinyal; aturan konflik "yang terakhir dicatat menang"; satu migrasi dan perubahan kecil API.

**Tidak masuk:** unggah saat aplikasi tertutup (iOS tidak mendukung Background Sync), layar pemilihan versi saat konflik, aksi tulis lain (jadwal, pesan, admin, edit pond), replikasi database penuh.

## 2. Keputusan pemilik produk

- Cakupan: input data dan foto eviden (termasuk menyelesaikan event).
- Konflik: yang **terakhir dicatat** menang, diukur dari waktu dicatat di HP, bukan waktu unggah.
- Pendekatan: antrean di IndexedDB dan mesin sinkron di dalam aplikasi (bukan service worker Background Sync).

## 3. Antrean (IndexedDB)

Basis data `evo-outbox`, satu store `items`:

`{ id (uuid), owner (user id), kind: 'weather' | 'water' | 'coagulant' | 'evidence' | 'complete', key, payload, blob?, recordedAt (ISO UTC, jam HP), seq, status: 'pending' | 'failed', error?, tries }`

- `key` untuk data: `weather|{date}`, `water|{date}|{sp}`, `coagulant|{date}|{sp}|{type}`. Simpan ulang untuk kunci yang sama yang masih `pending` **menggantikan** isian lama (waktu dicatat ikut diperbarui). Item `failed` tidak diganti; simpan baru membuat item baru.
- Eviden: `key = evidence|{scheduleId}|{date}|{id}`, `blob` = file foto, `payload` = metadata (sumber, lintang, bujur, akurasi, waktu ambil, nama). Setiap foto adalah item sendiri.
- `complete`: `key = complete|{scheduleId}|{date}`; hanya dikirim setelah semua item `evidence` untuk jadwal dan tanggal yang sama terunggah (urutan lewat `seq`, dan aturan ketergantungan ini).
- `seq` naik monoton; pengiriman berurutan menurut `seq`, kecuali `complete` yang menunggu `evidence` sejadwalnya.
- Gagal menulis ke IndexedDB (penuh, diblokir) = simpan ditolak dengan pesan Indonesia, tidak diam-diam hilang. Bila IndexedDB tidak tersedia, perilaku kembali seperti sekarang (butuh koneksi).
- Penyimpanan diminta persisten (`navigator.storage.persist()`) saat antrean pertama dibuat.

## 4. Simpan di layar input

`saveEntry(kind, key, payload)` di lapisan baru `lib/outbox`:
1. Coba kirim langsung (jalur yang ada, ditambah `recordedAt`).
2. Galat jaringan (`ApiError.status === 0`) atau peramban melaporkan offline: masukkan ke antrean, tampilkan "Tersimpan di HP, menunggu sinyal" (bukan galat), dan layar tidak menampilkan pesan merah.
3. Galat 4xx dari server (nilai tak sah, tak berhak): tampilkan seperti sekarang, jangan diantre.
4. 401: antre dan jeda; tampilkan ajakan masuk kembali (lihat bagian 6).

Layar hari (`useDay`) membaca `/day` dari jaringan; bila gagal karena offline, memakai salinan terakhir di cache (bagian 7) lalu menimpa dengan isian `pending` dari antrean untuk tanggal dan pond itu, sehingga angka yang baru diketik muncul lagi saat layar dibuka kembali. Sisa stok koagulan yang tampil saat offline dihitung di klien dari stok sebelumnya (fungsi bersama `defaultRemaining`) dan ditandai "perkiraan sampai terunggah".

Kamera: foto yang gagal diunggah karena offline masuk antrean dengan GPS dan waktu yang sudah ditanam saat dipotret. "Selesaikan event" saat offline masuk antrean setelah eviden-nya.

## 5. Mesin sinkron

Modul `lib/outbox/sync.ts`, satu instans, dijalankan dari `App` setelah login.

- Pemicu: acara `online`, aplikasi dibuka, tab kembali terlihat, setelah tiap antre, dan pengatur waktu (30 detik) selama ada item. Satu putaran pada satu waktu (penanda di dalam halaman; antar-tab memakai Web Locks `navigator.locks` bila ada).
- Hanya item milik pengguna yang sedang masuk yang dikirim; item pengguna lain tetap tersimpan dan tidak tampil sebagai milik pengguna ini.
- Hasil per item: sukses atau "sudah ada yang lebih baru" (`applied: false`) menghapus item; galat jaringan atau 5xx menaikkan `tries` dan menunda dengan jeda bertahap (5 s, 15 s, 60 s, 5 menit, tetap 5 menit); 401 menjeda seluruh antrean tanpa membuang apa pun sampai sesi pulih; 4xx lain menandai item `failed` dengan pesan dari server dan tidak dicoba ulang otomatis.
- Setelah antrean kosong, layar yang sedang terbuka memuat ulang datanya (peristiwa `outbox:drained`).

## 6. Tampilan

- `ConnectionChip` menjadi `SyncChip`: offline = "Tidak ada koneksi" (ditambah "- 3 menunggu" bila ada antrean); online dengan antrean = "Mengunggah 3…"; ada item gagal = lencana "1 gagal" yang membuka daftar. Tanpa antrean dan online: tidak tampil (seperti sekarang).
- Daftar antrean (lembar dari chip): jenis dan tanggal dan pond dalam bahasa manusia, status, pesan galat, tombol "Coba lagi" dan "Buang" (Buang minta konfirmasi dan menyebut data apa yang hilang). Tombol dan target minimal 44 px, status bukan hanya warna.
- Keluar akun saat antrean tidak kosong: dialog "Ada N data belum terunggah. Keluar akan menyimpannya di HP sampai Anda masuk lagi." Antrean tidak dihapus saat keluar.
- Sesi habis dengan antrean: banner "Masuk kembali untuk mengunggah N data."

## 7. Baca offline

Konfigurasi Workbox `runtimeCaching`: `GET /api/day`, `/api/ponds`, `/api/events`, `/api/auth/me` dengan `NetworkFirst` (batas 3 detik sebelum memakai cache), nama cache `evo-api`, maksimum 60 entri dan 14 hari. Cache dibersihkan saat keluar akun. Layar yang butuh data lain (Laporan, Eviden, Dashboard) tetap butuh koneksi dan menampilkan pesan yang ada sekarang.

## 8. API

Migrasi `0005`: kolom `client_ts TEXT` (ISO UTC, boleh NULL) pada `weather`, `surface_water`, `coagulant`; kolom `client_id TEXT` pada tabel eviden dengan indeks unik parsial `WHERE client_id IS NOT NULL`.

- `PUT /weather/:date`, `/water/:date/:sp`, `/coagulant/:date/:sp/:type` menerima `recorded_at` (ISO UTC) opsional. Tanpa `recorded_at` perilaku lama (selalu menimpa) dan `client_ts` diisi waktu server. Dengan `recorded_at`: nilai di masa depan lebih dari 5 menit dari jam server dibatasi ke jam server; bila `recorded_at` **lebih lama** dari `client_ts` tersimpan, tidak menimpa dan respons `200 { applied: false, reason: 'newer-exists' }`; selain itu menimpa dan respons seperti sekarang ditambah `applied: true`.
- Tulis koagulan tetap menghitung ulang rantai sisa stok di server.
- `POST /events/:scheduleId/:date/evidence` menerima `client_id` (uuid) pada form; bila sudah ada eviden dengan `client_id` itu, mengembalikan eviden yang ada (`200`) tanpa membuat baris atau berkas R2 kedua.
- `POST /events/:scheduleId/:date/complete` tidak diubah. Panggilan kedua membalas 409 "Event ini sudah selesai."; mesin sinkron memperlakukan balasan itu sebagai berhasil (event memang sudah selesai), dan tes memastikan dua panggilan tetap menghasilkan satu penyelesaian.

## 9. Teknis

- `lib/outbox/db.ts` (IndexedDB tipis, tanpa pustaka), `lib/outbox/queue.ts` (antre, ganti, daftar, hapus, tandai), `lib/outbox/sync.ts` (mesin), `lib/outbox/save.ts` (`saveEntry`), hook `useOutbox()` (jumlah dan daftar, berlangganan perubahan), komponen `SyncChip` dan `OutboxSheet`.
- Semua tulis yang ada dialihkan ke `saveEntry`: layar Cuaca, Air, Koagulan; kamera dan unggah eviden; selesaikan event.
- Waktu dicatat memakai `new Date().toISOString()`; jam HP yang salah jauh di belakang berarti datanya kalah dari edit lain, dan itu dicatat sebagai batas yang diketahui.

## 10. Pengujian dan verifikasi

Unit (`fake-indexeddb`): antre, ganti item `pending` untuk kunci sama, item `failed` tidak diganti, urutan `seq`, `complete` menunggu `evidence`, item pemilik lain tidak dikirim; mesin: sukses, `applied:false`, jaringan dan 5xx dengan jeda, 4xx menjadi `failed`, 401 menjeda tanpa kehilangan, satu putaran pada satu waktu; `saveEntry` (online, offline, 4xx, IndexedDB tak tersedia); layar (pesan "Tersimpan di HP", angka tertunda muncul lagi, chip, daftar, keluar akun memperingatkan). API: urutan `recorded_at`, masa depan dibatasi, tanpa `recorded_at` menimpa, `client_id` ganda, `complete` dua kali. Chrome nyata (CDP `Network.emulateNetworkConditions` offline): isi cuaca dan air dan koagulan, potret foto, selesaikan event; tutup dan buka lagi aplikasi; nyalakan jaringan; semua terunggah tanpa ganda; edit lebih baru dari perangkat lain tidak tertimpa. Tes HP sungguhan baru setelah deploy HTTPS (hanya dengan izin pemilik).

## 11. Asumsi dan batas yang diketahui

- Unggah hanya berjalan saat aplikasi terbuka (tab atau PWA terpasang di latar depan).
- Satu perangkat satu antrean; dua perangkat offline menulis kunci yang sama diselesaikan oleh aturan waktu dicatat.
- Foto berukuran sampai 10 MB seperti sekarang; ruang IndexedDB peramban dianggap cukup untuk puluhan foto.
- Hapus (DELETE) dan edit jadwal tidak diantre.
