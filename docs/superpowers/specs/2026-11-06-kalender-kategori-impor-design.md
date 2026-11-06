# Kalender Enviro: kategori, titik per kategori, impor Excel

Tanggal: 2026-11-06. Status: menunggu persetujuan.

## Tujuan
Event enviro mengikuti struktur kerja yang sudah dipakai: **Kategori**, **Event (Outstanding)**, **Frekuensi atau due date**. Kalender menampilkan kategori lewat warna. Event satu tahun penuh bisa dimasukkan lewat satu berkas Excel, tanpa input satu per satu.

## Keputusan dari diskusi
- Kegiatan sekali setahun berulang tiap tahun di tanggal yang sama. Itu sudah frekuensi **Tahunan**, jadi tidak ada jenis jadwal baru.
- Satu event punya paling banyak satu kategori.
- Kategori dan impor hanya untuk Manager dan Admin.
- Warna dipilih dari palet siap pakai (16 warna).
- Event tidak memakai pond: kolom pond dihapus dari form event dan dari Excel.
- Kategori yang belum ada di master dibuat otomatis saat impor. Baris yang sama dengan event yang sudah ada diperbarui.

## 1. Data
**Tabel baru `event_categories`:** `id`, `name` (unik tanpa membedakan huruf besar kecil), `color` (nilai heksa dari palet), `is_active` (default 1), `created_at`.

**`event_schedules`:** tambah `category_id` (boleh kosong, merujuk `event_categories`). Event lama tetap kosong dan tampil sebagai "Tanpa kategori" (abu-abu). Kolom `sp_id` tetap ada di database dan tidak dihapus, tetapi tidak lagi diisi atau ditampilkan.

Kategori tidak dihapus, hanya dinonaktifkan. Kategori nonaktif tidak muncul di pilihan saat membuat event baru, tetapi event lama tetap memakai warnanya.

**Palet (`packages/shared`):** 16 warna tetap, dipilih agar mudah dibedakan di atas latar terang. Kategori yang dibuat otomatis saat impor mengambil warna pertama dalam palet yang belum dipakai kategori aktif. Kalau palet habis, mengulang dari awal.

## 2. API
- `GET /event-categories` untuk semua pengguna yang masuk (warna dibutuhkan kalender). Mengembalikan kategori aktif dan nonaktif.
- `POST /event-categories`, `PATCH /event-categories/:id` (nama, warna, aktif) untuk Manager dan Admin. Nama kembar ditolak dengan 409.
- Jadwal: `POST` dan `PATCH /schedules` menerima `category_id` (kosong boleh) dan tidak lagi menerima `sp_id`. `GET` jadwal dan tiap kemunculan event membawa `category_id`, `category_name`, `category_color`.
- `POST /schedules/import` (Manager dan Admin). Menerima `{ rows, dry }`. Maksimal 500 baris. Dengan `dry: true` mengembalikan hasil per baris tanpa menyimpan; tanpa `dry` menyimpan baris yang sah.

## 3. Titik kategori di kalender
- Tiap hari menampilkan **satu titik per kategori** yang punya event hari itu, disusun melingkar mengelilingi angka tanggal. Maksimal 8 titik ditampilkan; sisanya diringkas dengan titik "+".
- Status (overdue, menunggu, selesai) tidak ditampilkan pada grid. Status hanya tampil di samping kalender: daftar Overdue dan daftar event pada tanggal terpilih, seperti sekarang.
- Legenda di bawah grid diganti daftar kategori beserta warnanya, hanya kategori yang muncul di bulan itu.
- Label aksesibilitas tiap hari menyebut nama kategorinya, bukan status.
- Kartu event menampilkan nama kategori sebagai label berwarna.
- Ringkasan kalender di beranda manager memakai grid yang sama.

## 4. Master kategori
Layar baru `/kalender/kategori` untuk Manager dan Admin, dibuka dari tombol "Kategori" di halaman Atur Jadwal. Isinya daftar kategori (warna, nama, jumlah event aktif), tambah, ubah nama dan warna, dan nonaktifkan atau aktifkan kembali. Pemilih warna menampilkan 16 warna dari palet.

Form Atur Jadwal mendapat pilihan **Kategori** (opsional) dan kehilangan pilihan pond.

## 5. Impor Excel
Layar `/kalender/jadwal/impor`, dibuka dari tombol "Impor Excel" di Atur Jadwal.

**Templat (.xlsx, bisa diunduh):** lembar `Event` dengan kolom `Kategori`, `Event`, `Frekuensi atau due date`, `Tanggal mulai`, dan lembar `Petunjuk` berisi aturan serta contoh.

**Aturan baris**
- `Kategori` boleh kosong (jadi tanpa kategori). `Event` wajib, maksimal 120 karakter.
- `Frekuensi atau due date` berisi nama frekuensi (Harian, Mingguan, Bulanan, 3-Bulanan, 6-Bulanan, Tahunan, atau padanan Inggrisnya, tanpa membedakan huruf) **atau sebuah tanggal**. Kalau berisi tanggal, event dijadikan **Tahunan** dengan tanggal itu sebagai tanggal mulai, dan kolom `Tanggal mulai` diabaikan.
- Untuk frekuensi berupa kata, `Tanggal mulai` wajib diisi.
- Tanggal dikenali dalam bentuk tanggal Excel asli, `2026-11-02`, atau `02/11/2026`. Batas tanggal mulai sama dengan form biasa (1 Jan 2000 sampai 5 tahun dari sekarang).
- Baris kosong dilewati.

**Pencocokan.** Baris cocok dengan event aktif yang judulnya sama dan kategorinya sama (tanpa membedakan huruf besar kecil dan spasi di tepi).
- Tidak ada yang cocok: dibuat baru.
- Cocok dan frekuensi atau tanggal mulai berbeda: diperbarui. Kalau event itu sudah punya catatan selesai atau eviden, frekuensi dan tanggal mulai terkunci seperti di form biasa, sehingga baris itu dilewati dengan alasan "sudah punya catatan".
- Cocok dan tidak ada yang berbeda: dilaporkan "tidak berubah".

**Alur.** Pilih berkas, lalu pratinjau: ringkasan jumlah baru, diperbarui, tidak berubah, dilewati, dan bermasalah, ditambah tabel per baris dengan alasannya (kategori baru ditandai). Tombol "Impor" menyimpan baris yang sah saja. Mengimpor berkas yang sama dua kali tidak membuat duplikat. Kategori baru dibuat bersama impor.

**Pembaca Excel.** Dibuat sendiri dengan `fflate` yang sudah ada: membaca `sharedStrings`, lembar pertama bernama `Event` atau lembar pertama bila tidak ada, dan seri tanggal Excel. Tidak ada dependensi baru. Hanya `.xlsx`. Berkas lebih dari 500 baris ditolak dengan pesan jelas.

## 6. Pengujian
- shared: palet, penguraian frekuensi dan tanggal, pencocokan baris.
- API: master kategori (izin, nama kembar, nonaktif), jadwal dengan kategori, impor `dry` dan nyata (baru, perbarui, terkunci, tidak berubah, kategori otomatis, batas 500).
- web: pembaca xlsx (tanggal serial, teks, sel kosong), grid titik melingkar, layar kategori, layar impor, form jadwal tanpa pond.

## Di luar cakupan
Filter kalender per kategori, impor `.csv`, penghapusan kategori, ekspor event ke Excel, dan penghapusan kolom `sp_id` dari database.

## Asumsi yang perlu dikonfirmasi
1. Event lama yang sudah punya `sp_id` tetap tampil di semua pond; nilai lamanya diabaikan.
2. Kolom penanggung jawab tidak ada di Excel; penanggung jawab tetap diatur dari form Atur Jadwal.
3. Deskripsi event tidak ada di Excel; diisi dari form bila perlu.
