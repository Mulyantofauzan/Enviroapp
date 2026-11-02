# EVO Bagian 3: Bukti (kamera, geotag, layar Eviden)

Melanjutkan `2026-11-02-evo-calendar-design.md`. Desain acuan: `design/08 Kamera Live (Geotag).png`, `design/07 Eksekusi Event & Eviden.png`, `design/Eviden Auditor (Read-only).png`. Antislop mode "selama bekerja" berlaku.

## 1. Cakupan

**Masuk:** kamera langsung di halaman Eksekusi event dengan cap lokasi dan waktu di dalam gambar, kolom lokasi pada eviden, pratinjau besar, layar Eviden (daftar lintas event, filter, unduh satu per satu, unduh semua dalam ZIP), tab dan tautan navigasi.

**Tidak masuk:** lampiran foto di form Input (Figma Input Cuaca), mode luring (bagian 5), Laporan (bagian 4).

## 2. Keputusan pemilik produk

- Bangun lengkap; uji di komputer dengan kamera dan lokasi buatan; uji di HP setelah deploy HTTPS.
- GPS tidak tersedia: foto tetap tersimpan dan ditandai "Tanpa lokasi".
- Cakupan: kamera di event + layar Eviden.

## 3. Kamera

Tombol **"Ambil foto"** (utama) dan **"Unggah galeri"** (garis tepi) di Eksekusi event untuk Operator dan Admin pada event yang masih terbuka. Kamera tampil sebagai dialog layar penuh (`role="dialog"`, `aria-modal`, Escape menutup, fokus awal pada tombol tutup):

- Kepala "Kamera eviden" dengan judul event, tombol tutup (X).
- Pratinjau langsung (`getUserMedia`, `facingMode: environment` sebagai pilihan awal), bilah info: `GPS -3.78421, 115.60214` dan `02 Nov 2026, 08:34:12 WITA`, catatan "Geotag dan timestamp otomatis ditempel pada foto".
- Kontrol bawah: tombol galeri (membuka pemilih berkas dan mengunggah sebagai galeri), rana (lingkaran putih besar), balik kamera.
- Setelah memotret: pratinjau foto bercap dengan "Ulangi" dan "Gunakan foto". "Gunakan foto" mengunggah.

**Cap dalam gambar.** Saat memotret, bingkai video digambar ke kanvas, diperkecil sehingga sisi terpanjang maksimal 1600 px, lalu bilah gelap setengah transparan di bawah memuat teks cap, dan hasilnya dikodekan JPEG kualitas 0,85. Format teks: `GPS {lat}, {lng} - {tanggal waktu} WITA` dengan lintang dan bujur lima desimal bertitik (seperti Figma) dan waktu WITA (`2 Nov 2026 08:21`); tanpa lokasi: `Tanpa lokasi - {tanggal waktu} WITA`. Teks mengecil mengikuti lebar gambar agar tidak terpotong.

**Lokasi.** `watchPosition` (akurasi tinggi) mulai saat kamera terbuka dan berhenti saat ditutup. Status: mencari, siap, ditolak, tidak tersedia. Titik terakhir yang sah dipakai saat rana ditekan; bila belum ada, foto bercap "Tanpa lokasi".

**Keadaan galat kamera** (pesan Indonesia, tombol galeri tetap tersedia): bukan HTTPS ("Kamera butuh koneksi aman (HTTPS)."), izin ditolak ("Izin kamera ditolak. Aktifkan di pengaturan peramban."), tidak ada kamera ("Kamera tidak ditemukan."), gagal lain ("Kamera tidak bisa dibuka. Coba lagi."). Semua trek video dihentikan saat dialog ditutup, saat komponen dilepas, saat galat, dan setelah memotret (lampu kamera tidak boleh menyala sisa).

Foto dari galeri tidak diberi cap dan tidak membawa koordinat; ditandai "Galeri".

## 4. Data dan API

Migrasi `0004`: `evidences` tambah `source TEXT NOT NULL DEFAULT 'gallery'` (`camera` atau `gallery`) dan `gps_accuracy REAL`. `gps_lat`, `gps_lng`, `taken_at` sudah ada.

`POST /events/:id/:date/evidence` menerima kolom formulir opsional di samping `file`: `source`, `gps_lat`, `gps_lng`, `gps_accuracy`, `taken_at` (ISO 8601).
- `source` default `gallery`; nilai selain `camera` atau `gallery` -> 400.
- `source=camera` wajib `taken_at` valid, tidak lebih dari 5 menit di masa depan dan tidak lebih dari 14 hari ke belakang; koordinat opsional tetapi harus berpasangan (lintang dan bujur sama-sama ada atau sama-sama tidak), lintang -90..90, bujur -180..180, akurasi 0..100000. Pelanggaran -> 400 dengan pesan Indonesia.
- `source=gallery`: kolom lokasi dan waktu foto diabaikan (disimpan null).
- Waktu unggah tetap dicatat server (`uploaded_at`).

Respons unggah dan daftar eviden di detail event mencakup `source`, `gps_lat`, `gps_lng`, `gps_accuracy`, `taken_at`.

`GET /evidence?from=&to=&schedule=&sp=&offset=&limit=`: semua peran yang masuk. Tanggal pada `due_date` event, rentang maksimal 366 hari, wajib. `limit` default 50, maksimal 100; `offset` default 0. `schedule` menyaring satu jadwal; `sp` menyertakan jadwal pond itu dan jadwal tanpa pond. Respons: `{ total, items: [{ id, filename, mime, size, source, gps_lat, gps_lng, gps_accuracy, taken_at, uploaded_at, uploaded_by_name, uploaded_by_role, schedule_id, title, due_date, sp_id }] }`, urut `due_date` lalu `uploaded_at` menurun. Dua query per permintaan.

## 5. Layar

**Eksekusi event:** baris eviden menampilkan gambar kecil (atau ikon dokumen), nama berkas, ukuran, pengunggah, waktu, serta satu dari: baris koordinat `GPS -3.78421, 115.60214` (sumber kamera dengan lokasi), lencana "Tanpa lokasi" (kamera tanpa lokasi), lencana "Galeri". Mengetuk gambar membuka **pratinjau besar** (dialog dengan gambar penuh, judul event, tanggal, pengunggah, koordinat, tombol Unduh dan Tutup; PDF membuka tab baru). Tombol hapus tetap seperti sebelumnya.

**Eviden (`/eviden`):** kepala "Eviden Lapangan" dengan subjudul "{Peran} - {pond}" dan lencana "Hanya baca" bagi Auditor; chip "Semua" dan satu chip per judul jadwal; kontrol tiga pilihan 7, 30, 90 hari (default 30); daftar kartu (gambar 16:10, judul event, tanggal dan jam WITA, "{nama} - {peran}", baris koordinat atau lencana, tombol "Pratinjau" dan "Unduh"); "Muat lebih banyak" bila `total` melebihi yang tampil; tombol **"Unduh semua eviden (ZIP)"**. Keadaan: memuat, kosong ("Belum ada eviden pada rentang ini."), galat dengan sebab.

**ZIP:** dibuat di peramban dengan `fflate` (tanpa kompresi tambahan karena gambar sudah terkompresi). Mengambil hingga 100 berkas satu per satu dengan indikator "Menyiapkan 12 dari 40"; bila `total` > 100: "Ada {n} eviden. Persempit rentang agar tidak lebih dari 100." tanpa mengunduh. Nama berkas di dalam ZIP `{due_date}_{judul}_{no}_{nama}` dengan karakter tidak aman dibersihkan dan dijamin unik. Gagal mengunduh satu berkas membatalkan ZIP dengan pesan yang menyebut berkas itu; tidak ada ZIP separuh jadi.

**Navigasi:** Auditor: Kalender, Riwayat, Eviden, Akun. Operator, Manager, Admin: tautan "Eviden lapangan" di menu Akun (dan di rel samping layar lebar). Ikon baru: kamera, gambar, balik kamera, unduh.

## 6. Pengujian dan verifikasi

Uji unit: teks cap (tanda koordinat, batas hari WITA, tanpa lokasi), validasi API (koordinat, waktu, pasangan, sumber), daftar eviden (filter, urutan, halaman, batas), hak per peran, siklus hidup kamera dengan `getUserMedia` dan `geolocation` tiruan (trek dihentikan di semua jalur), semua keadaan galat, ZIP (isi, nama unik, batas 100, kegagalan), layar Eviden. Verifikasi di Chrome nyata dengan kamera buatan (`--use-fake-device-for-media-stream`) dan lokasi buatan (override geolokasi lewat CDP): memotret sampai foto bercap tersimpan, dibaca ulang dari server, gambar bercap terlihat, ZIP terunduh dan isinya diperiksa. Uji di HP menunggu deploy HTTPS.

## 7. Asumsi

- Koordinat dan waktu foto berasal dari GPS dan jam perangkat; tidak ada bukti kriptografis. Waktu unggah server tampil berdampingan di detail.
- Hanya foto dari kamera aplikasi yang diberi cap dan lokasi.
- Chip filter dibuat dari judul jadwal yang ada (termasuk yang berhenti).
