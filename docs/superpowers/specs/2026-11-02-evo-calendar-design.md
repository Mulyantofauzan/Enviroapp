# EVO Bagian 2: Kalender Enviro Events dan Riwayat Tabel

Melanjutkan `2026-11-02-evo-ui-redesign-design.md`. Desain acuan: `design/06 Kalender Enviro Events.png`, `design/07 Eksekusi Event & Eviden.png` (tanpa tombol kamera). Antislop mode "selama bekerja" berlaku.

## 1. Cakupan

**Masuk:** jadwal berulang, kalender dengan overdue, eksekusi event dengan unggah eviden dari galeri (R2), menyelesaikan event, atur jadwal (Manager dan Admin), kartu dan banner event di Beranda, Riwayat berbentuk tabel.

**Tidak masuk (bagian berikut):** kamera langsung, geotag, dan cap waktu pada foto, layar Eviden Auditor, unduh ZIP (bagian 3); Laporan dan ekspor Excel, PDF, serta event pada Laporan (bagian 4); mode luring (bagian 5).

## 2. Keputusan pemilik produk

- Unggah eviden dari galeri ikut bagian ini, karena event baru selesai setelah ada eviden.
- Jadwal berulang disimpan sebagai aturan, kejadian per tanggal dihitung saat dibaca. Tanggal yang terlewat tanpa eviden tampil sebagai **satu baris Overdue per tanggal** dan tidak hilang.
- Riwayat ditampilkan sebagai tabel.
- Admin punya akses penuh (termasuk atur jadwal dan menjalankan event).

## 3. Data (migrasi 0003)

- `event_schedules(id, title, description, frequency, start_date, sp_id NULL, assigned_to NULL, ended_on NULL, created_by, created_at)`. `frequency` salah satu: `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Semi-Annual`, `Annual`. `sp_id` kosong berarti semua lokasi. `assigned_to` hanya informasi. `ended_on` terisi saat jadwal dihentikan.
- `event_completions(schedule_id, due_date, completed_by, completed_at, completed_on, PRIMARY KEY(schedule_id, due_date))`. `completed_on` adalah tanggal lokal (WITA) penyelesaian.
- `evidences(id, schedule_id, due_date, r2_key, filename, mime, size, uploaded_by, uploaded_at, gps_lat NULL, gps_lng NULL, taken_at NULL)`. Tiga kolom terakhir kosong sampai bagian 3.

## 4. Aturan kejadian

Kejadian ke-k dari jadwal: `Daily` tanggal mulai + k hari; `Weekly` + 7k hari; `Monthly`, `Quarterly`, `Semi-Annual`, `Annual` tanggal yang sama tiap 1, 3, 6, 12 bulan; bila bulan itu lebih pendek dari tanggal jangkar (misalnya 31), pakai hari terakhir bulan itu, dihitung dari jangkar (bukan bergeser berantai). Tidak ada kejadian sebelum `start_date` atau setelah `ended_on`. Kejadian yang sudah lewat sebelum penghentian tetap ada.

Zona waktu satu situs: WITA (`Asia/Makassar`, UTC+8). "Hari ini" dihitung di server dan dikirim ke klien.

Status kejadian (turunan):
- **Selesai**: ada baris di `event_completions`. Bila `completed_on` > `due_date`, ditandai terlambat.
- **Overdue**: `due_date` < hari ini dan belum selesai.
- **Hari ini**: `due_date` = hari ini dan belum selesai.
- **Mendatang**: `due_date` > hari ini.

Menyelesaikan event: minimal satu eviden, dan hanya bila `due_date` ≤ hari ini. Unggah eviden juga hanya bila `due_date` ≤ hari ini dan event belum selesai. Setelah selesai, eviden terkunci (tidak bisa ditambah atau dihapus). Penyelesaian tidak bisa dibatalkan.

Eviden: foto (jpeg, png, webp, heic) atau PDF, maksimal 10 MB per file. Tipe ditentukan dari isi file (tanda tangan byte), bukan dari tipe yang diklaim klien. File disimpan di R2 dengan kunci `evidence/{schedule}/{due_date}/{uuid}`; nama asli hanya di database. Penghapusan eviden oleh pengunggah atau Admin selama event belum selesai.

Jadwal: `frequency` dan `start_date` terkunci begitu ada penyelesaian atau eviden untuk jadwal itu. Judul, deskripsi, pond, dan ditugaskan ke bisa diubah kapan saja. Menghentikan jadwal mengisi `ended_on` dengan hari ini.

Hak akses: Manager dan Admin membuat, mengubah, dan menghentikan jadwal. Operator dan Admin mengunggah, menghapus, dan menyelesaikan. Semua peran yang masuk melihat kalender dan mengunduh eviden.

## 5. API

Semua rute butuh sesi. Pesan galat Bahasa Indonesia.

- `GET /schedules` (`?all=1` ikut yang berhenti), `POST /schedules`, `PATCH /schedules/:id`, `POST /schedules/:id/stop`.
- `GET /events?from=&to=&frequency=&sp=`: kejadian pada rentang (maksimal 62 hari) beserta `today`. Setiap kejadian: `schedule_id, title, description, frequency, sp_id, assigned_to_name, due_date, status, late, evidence_count, completed_at, completed_by_name`.
- `GET /events/overdue?frequency=&sp=`: semua kejadian overdue, terbaru dulu, maksimal 200, dengan `total`.
- `GET /events/summary`: `{ today, overdue, due_today }`.
- `GET /events/:scheduleId/:date`: detail satu kejadian dan daftar eviden. 404 bila tanggal itu bukan kejadian jadwal tersebut.
- `POST /events/:scheduleId/:date/evidence` (multipart, kolom `file`), `DELETE /evidence/:id`, `GET /evidence/:id/file` (tanpa URL publik, `X-Content-Type-Options: nosniff`, PDF sebagai unduhan).
- `POST /events/:scheduleId/:date/complete`.

Jumlah query tetap kecil per permintaan (kejadian dihitung di memori dari jadwal, bukan per baris).

## 6. Layar

**Kalender** (tab untuk semua peran): kepala "Kalender Enviro" dengan bulan, strip minggu (Sen sampai Min, titik merah bila hari itu punya overdue, titik biru bila terjadwal, panah minggu sebelum dan sesudah), chip filter frekuensi (Semua, Harian, Mingguan, Bulanan, 3-Bulanan, 6-Bulanan, Tahunan), daftar: semua Overdue di atas (kartu merah dengan tombol "Unggah eviden" untuk Operator dan Admin), lalu kejadian pada hari yang dipilih. Keadaan kosong menyebut sebab ("Tidak ada event pada tanggal ini."). Manager dan Admin melihat tombol "Atur jadwal".

**Eksekusi event** (`/kalender/:jadwal/:tanggal`): judul, status, pond dan tenggat, deskripsi, daftar eviden (nama, ukuran, pengunggah, pratinjau gambar, unduh, hapus bila diizinkan), tombol "Unggah galeri", banner "Overdue tetap tampil. Selesai setelah eviden diunggah", tombol "Selesaikan event" (aktif bila ada eviden). Event selesai: baca saja, menampilkan siapa dan kapan, dan "Terlambat" bila perlu. Peran baca saja melihat eviden tanpa tombol aksi.

**Atur jadwal** (`/kalender/jadwal`, Manager dan Admin): daftar jadwal (frekuensi, pond, tanggal mulai, aktif atau berhenti), tambah dan ubah (judul, deskripsi, frekuensi, tanggal mulai, pond, ditugaskan ke), hentikan dengan konfirmasi.

**Beranda Operator dan Admin:** kartu "Event Enviro" (subtitle "N event overdue" atau "Tidak ada yang telat") dan banner merah "N event overdue / Unggah eviden untuk menyelesaikannya" yang membuka Kalender.

**Navigasi:** tab Kalender ditambahkan: Operator (Beranda, Input, Kalender, Akun), Manager (Beranda, Kalender, Akun), Auditor (Kalender, Riwayat, Akun), Admin (Beranda, Input, Kalender, Akun). Menu Atur jadwal lewat tombol di Kalender, juga di menu Kelola Akun untuk Admin.

## 7. Riwayat sebagai tabel

Filter Dari, Sampai, Settling Pond tetap. Di atas tabel ada kontrol tiga pilihan: **Air permukaan**, **Cuaca**, **Koagulan**. Tabel di dalam wadah yang bisa digulir ke samping dengan kolom Tanggal menempel di kiri, baris terbaru di atas, 50 baris per halaman dengan tombol "Tampilkan lebih banyak".

| Pilihan | Kolom |
|---|---|
| Air permukaan | Tanggal, Pond, pH inlet, pH outlet, TSS inlet, TSS outlet, Debit inlet (m³/d), Debit outlet (m³/d) |
| Cuaca | Tanggal, Rainfall (mm), Rain hours (jam) |
| Koagulan | Tanggal, Pond, Jenis, Masuk, Keluar, Sisa, penanda selisih |

Angka berformat id-ID, sel kosong `–`. Sel outlet di luar baku mutu pond itu bertanda merah (latar `danger-soft`, tebal) dan penanda selisih stok memakai teks "Selisih" di sel Sisa. Operator dan Admin mendapat kolom aksi dengan ikon pensil ber-label ("Ubah 2 Nov 2026 SP-02") menuju layar input hari itu. Tabel memakai `caption`, `th scope`, dan bisa dijangkau keyboard. Keadaan kosong, memuat, dan galat tetap ada.

Tabel ini juga menjadi pratinjau di Laporan pada bagian 4, yang menambah periode, lokasi, pilihan data, dan ekspor.

## 8. Teknis

Binding R2 `EVIDENCE` di `wrangler.jsonc` (dan di `wrangler.test.jsonc`). Wrangler mensimulasikan R2 sendiri saat pengembangan. Untuk deploy: `wrangler r2 bucket create evo-evidence`. Unggah multipart dibatasi 10 MB per file di API.

## 9. Pengujian dan verifikasi

Uji unit: hitungan tenggat tiap frekuensi (jangkar tanggal 29, 30, 31, tahun kabisat, batas rentang), status. Uji API: hak per peran, migrasi 0003 pada data yang ada, unggah (tipe palsu ditolak, melebihi 10 MB ditolak, tanggal mendatang ditolak), penyelesaian tanpa eviden ditolak, penguncian setelah selesai, penghapusan oleh pihak lain ditolak, jadwal terkunci, jumlah query. Uji web: kalender, strip minggu, eksekusi event, atur jadwal, Beranda, Riwayat tabel. Verifikasi Chrome nyata di 360px dan 1200px, plus uji di HP.

## 10. Asumsi

- Kolom "ditugaskan ke" hanya informasi. Operator mana pun boleh menyelesaikan event.
- Tidak ada batas jumlah eviden per event selain 10 MB per file.
- Jadwal yang dihentikan tidak bisa diaktifkan lagi; buat jadwal baru bila perlu.
- Penyelesaian tidak bisa dibatalkan lewat aplikasi.
- Overdue dihitung dari awal jadwal tanpa batas; daftar Overdue menampilkan paling banyak 200, dengan jumlah total.
