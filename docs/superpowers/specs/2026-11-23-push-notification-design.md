# EVOS: Push notification (PWA)

## 1. Tujuan

Pengguna sering lupa mengisi pemantauan, melewatkan event kalender, dan terlambat tahu ada hasil di luar baku mutu. Notifikasi push mengingatkan mereka tanpa harus membuka aplikasi.

**Masuk:** tiga jenis notifikasi (bagian 3), tombol aktifkan/matikan di layar Akun, penyimpanan langganan perangkat, pengiriman dari Worker.

**Tidak masuk:** kotak masuk notifikasi di dalam aplikasi, pengaturan per jenis notifikasi, email, WhatsApp, notifikasi untuk Manager dan Auditor.

**Gagal bila:** pengguna menerima notifikasi berulang untuk hal yang sama, notifikasi sampai ke orang yang tidak berkepentingan, atau notifikasi tetap dikirim ke perangkat yang sudah keluar akun.

## 2. Pendekatan

Dipilih: **Web Push langsung dari Worker** (standar VAPID), tanpa layanan luar. Data pengguna dan perangkat tidak keluar dari sistem sendiri, tidak ada akun atau biaya tambahan.

Ditolak: OneSignal atau Firebase. Lebih cepat dipasang, tapi butuh akun luar dan mengirim data perangkat ke pihak ketiga; tidak sepadan untuk aplikasi internal.

## 3. Tiga jenis notifikasi

Semua jam memakai WITA (UTC+8). Cron Worker ditambah dua jadwal: `0 23 * * *` (07.00 WITA) dan `0 8 * * *` (16.00 WITA). Jadwal backup `0 18 * * *` tidak berubah; `scheduled()` memilih tugas dari `event.cron`.

Setiap notifikasi cron digabung per penerima (satu pesan berisi ringkasan), bukan satu pesan per item, supaya tidak membanjiri.

### 3.1 Pemantauan belum diisi
- **Kapan:** 16.00 WITA.
- **Apa:** untuk hari ini, pond aktif yang belum punya data air, dan/atau belum ada data cuaca (cuaca satu baris per tanggal, bukan per pond).
- **Penerima:** semua pengguna aktif berperan **Operator dan Admin** (mereka yang boleh menginput).
- **Isi:** "Belum diisi hari ini: SP 11 LGG (air), cuaca." Tidak dikirim bila semuanya sudah terisi.
- **Ketuk:** membuka Input Air & Koagulan.

### 3.2 Event kalender
- **Penerima:** semua pengguna aktif berperan **Operator dan Admin** (menurut level akun, bukan hanya orang yang ditugaskan).
- **07.00 WITA, "akan datang":** event yang jatuh tempo besok.
- **07.00 WITA, "jatuh tempo":** event yang jatuh tempo hari ini dan belum selesai.
- **16.00 WITA, "akan overdue":** event jatuh tempo hari ini yang masih belum selesai. Setelah hari berganti event itu masuk daftar overdue kalender.
- **Isi:** judul event (bila banyak, jumlahnya dan dua judul pertama).
- **Ketuk:** membuka Kalender.
- Memakai logika jadwal yang sudah ada (`dueDates`, `event_completions`), bukan hitungan baru.

### 3.3 Hasil di luar baku mutu
- **Kapan:** langsung saat data air disimpan (`PUT /water/:date/:sp`), termasuk data dari antrean offline yang baru terkirim.
- **Apa:** pH outlet atau TSS outlet di luar baku mutu pond (`isOutOfLimit`). Hari no flow (debit outlet 0) tidak dihitung.
- **Penerima:** semua pengguna aktif berperan **Admin**.
- **Isi:** "SP 11 LGG: TSS outlet 52 mg/L di atas baku mutu (maks. 40)."
- **Dedup:** sekali per pond, tanggal, dan parameter. Data diubah tapi tetap melanggar tidak dikirim lagi.
- **Ketuk:** membuka Dashboard.

## 4. Data

Migrasi `0008_push.sql`:
- `push_subscriptions(id, user_id, endpoint UNIQUE, p256dh, auth, created_at)`.
- `notification_log(key PRIMARY KEY, sent_at)`: kunci seperti `monitor|2026-11-23|user`, `event-due|2026-11-23|user`, `limit|2026-11-23|sp|tss_outlet|user`. Mencegah kiriman ganda bila cron berjalan ulang.

Secret Worker: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## 5. API

- `GET /push/key` mengembalikan kunci publik VAPID.
- `POST /push/subscribe` menyimpan langganan perangkat milik pengguna yang masuk (endpoint yang sama diperbarui, bukan dobel).
- `DELETE /push/subscribe` menghapus langganan perangkat ini.
- Langganan yang ditolak push service (404 atau 410) dihapus otomatis saat pengiriman.

## 6. Sisi aplikasi

- Layar Akun: tombol "Aktifkan notifikasi" dan "Matikan notifikasi". Izin hanya diminta saat tombol diketuk (syarat iOS). Bila browser tidak mendukung atau app belum di Layar Utama (iPhone), tampil penjelasan singkat.
- Keluar akun menghapus langganan perangkat itu (HP bisa dipakai bergantian).
- Service worker: penangan `push` dan `notificationclick` dimuat lewat `importScripts` pada konfigurasi workbox yang ada; mengetuk notifikasi memfokuskan jendela yang terbuka atau membuka rute tujuan.

## 7. Pilihan saya (bukan keputusan pemilik produk)

- Jam 07.00 dan 16.00 WITA. Penerima pengingat pemantauan (3.1) = Operator dan Admin, karena hanya mereka yang bisa menginput.
- Notifikasi digabung per penerima.
- Langganan dihapus saat keluar akun.
- Library Web Push yang cocok dengan Workers (enkripsi payload lewat WebCrypto) dipilih saat membangun; `web-push` bawaan Node tidak diasumsikan jalan.

## 8. Batasan

- iPhone: notifikasi hanya jalan bila app sudah ditambahkan ke Layar Utama (iOS 16.4 ke atas).
- Pengguna yang menolak izin tidak menerima apa pun.
- Pengiriman push bersifat upaya terbaik; tidak ada jaminan sampai.

## 9. Pengujian

- Pemilih penerima dan isi pesan sebagai fungsi murni: belum diisi (air, cuaca), event akan datang/jatuh tempo/akan overdue, pelanggaran baku mutu (termasuk no flow dan nilai null).
- Dedup lewat `notification_log` (cron dijalankan dua kali, simpan data dua kali).
- Endpoint langganan: wajib login, endpoint ganda diperbarui, hapus.
- Pengirim push dipalsukan di tes (tidak memanggil jaringan sungguhan).
- Layar Akun: tombol dan teks penjelasan untuk browser tanpa dukungan.
