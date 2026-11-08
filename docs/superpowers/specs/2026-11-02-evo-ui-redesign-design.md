# ENVIRO UI Redesign (Bagian 1) Design

Sumber desain: folder `design/` (10 + 5 gambar Figma, termasuk `EVO Foundations.png` dan `EVO Components.png`). Melanjutkan MVP di `docs/superpowers/specs/2026-11-02-evo-mvp-design.md`. Antislop (mode "selama bekerja") berlaku.

## 1. Tujuan dan cakupan

Mengganti tampilan MVP dengan desain Figma buatan pemilik produk, berbahasa Indonesia, dengan navigasi per peran.

**Masuk Bagian 1:** fondasi dan komponen Figma, ikon, navigasi per peran, Beranda (Operator/Admin dan Manager), tiga layar Input, Riwayat, Akun, Master Data Settling Pond, Kelola Pengguna.

**Menyusul (bagian terpisah, masing-masing spec dan plan sendiri):** 2 Kalender, 3 Bukti (kamera, eviden, layar Eviden Auditor, R2, HTTPS), 4 Laporan dan Ekspor (xlsx, pdf), 5 Mode luring (antrean sinkron).

Yang belum ada tidak ditampilkan: tidak ada chip "Tersinkron", kartu Event, banner overdue, atau tab Kalender, Laporan, Eviden. Chip luring hanya muncul saat benar-benar tidak ada koneksi.

## 2. Peran dan navigasi

Admin punya akses penuh ke semua fungsi. Peran lain mengikuti Figma.

Tab bawah (hanya tujuan yang sudah ada):

| Peran | Tab sekarang | Menyusul |
|---|---|---|
| Operator | Beranda, Input, Akun | Kalender, Laporan |
| Manager | Beranda, Akun | Kalender, Laporan |
| Auditor | Riwayat, Akun | Kalender, Eviden |
| Admin | Beranda, Input, Akun | Kalender, Laporan |

Tab **Akun** berisi profil, tombol Keluar, dan daftar menu: "Riwayat data" (Operator, Manager, Admin; Auditor sudah punya tab), serta "Kelola" untuk Admin: Pengguna, Master Pond. Layar ≥ 900px: tab bawah menjadi rel kiri berisi semua tujuan peran itu, termasuk menu Kelola.

Rute: `/` Beranda (Auditor dialihkan ke `/riwayat`), `/input`, `/input/cuaca`, `/input/air`, `/input/koagulan`, `/riwayat`, `/akun`, `/pengguna` dan `/master` (Admin). Rute yang tidak boleh dibuka peran tersebut mengalihkan ke beranda peran itu. API tetap penjaga utama.

Hak tulis data: Operator dan Admin. Manager dan Auditor membaca saja. Manajemen pengguna, pond, baku mutu: Admin.

## 3. Fondasi visual (dari `EVO Foundations.png`, dipakai apa adanya)

Warna: primary `#0E7C66`, primary-dark `#0A5C4B`, primary-soft `#E3F4EF`, water `#1C7ED6`, water-soft `#E4F0FB`, bg `#F4F7F6`, surface `#FFFFFF`, text `#12201C`, text-sub `#5E6E69`, text-on-primary `#FFFFFF`, border `#DAE3E0`, success `#12A150`, success-soft `#DDF5E6`, warning `#D97706`, warning-soft `#FFF1D6`, danger `#D92D20`, danger-soft `#FEE4E2`, camera `#101614`.

Tambahan turunan dari layar Pengguna (bukan dari Foundations): badge peran Auditor ungu lembut `#EDE9FB` dengan teks `#5B3FA8`.

Huruf: Inter. Skala: H1, H2, Body, Body strong, Label, Caption, Button, Number/Large (ukuran dari tangkapan Figma). Angka memakai tabular numerals.

Alasan tiap pilihan (antislop R-31): semua dari fondasi Figma buatan pemilik produk (R-37, R-20). Satu aksen sinyal: danger, hanya untuk nilai di luar baku mutu dan kesalahan.

**Keputusan pemilik produk:** warna dipakai persis Figma, tidak digelapkan. Pasangan yang dihitung gagal standar AA (teks kecil): teks warning `#D97706` di `#FFF1D6` (2,85:1), success `#12A150` di `#DDF5E6` (2,93:1), danger `#D92D20` di `#FEE4E2` (4,01:1), water `#1C7ED6` di `#E4F0FB` (3,63:1), serta garis batas input `#DAE3E0` di putih (1,31:1, di bawah 3:1). Ini dicatat sebagai keputusan sadar. Mitigasi tanpa mengubah warna: chip memakai teks tebal dan selalu berisi kata (Normal, Abnormal), bukan warna saja.

## 4. Komponen

Tombol (primary, outline, danger), kolom angka (label, satuan, keadaan normal, abnormal merah muda, otomatis hijau muda dengan chip "Otomatis", baca saja, pesan galat), chip dan badge (success, danger, solid danger, primary, water), chip status koneksi, kartu, kontrol tersegmen (Inlet/Outlet, 7/30/90 hari), pemilih pond, saklar, banner info, peringatan, dan bahaya, kepala layar (judul, subjudul, tombol profil), tab bawah dengan pil pilihan, rel samping.

Ikon: set SVG garis 24px buatan sendiri, bentuk mengikuti Figma: rumah, papan klip, kalender, grafik batang, orang, banyak orang, basis data, pin lokasi, awan hujan, tetes, labu, segitiga peringatan, info, tanda panah bawah dan kanan, kaca pembesar, plus, pensil, centang, dokumen, awan putus. Tiap ikon punya label teks di dekatnya atau `aria-label`.

## 5. Layar

**Beranda Operator/Admin:** salam "Halo, {nama depan}", subjudul "{Peran} - {hari, tanggal}", tombol profil, chip koneksi hanya saat luring, pemilih Settling Pond aktif, tiga kartu modul (Cuaca "Hujan & jam hujan", Air Permukaan "pH, TSS, debit", Koagulan "Kapur & tawas") yang membuka layar input, kartu "Data hari ini - {kode pond}": pH Outlet, TSS Outlet, Debit harian dengan chip Normal atau Abnormal. Chip hanya tampil bila baku mutu pond itu sudah diisi. Tanpa data hari ini: "Belum ada data air hari ini." dengan tombol "Isi data air".

**Beranda Manager (Dashboard):** kepala "Dashboard", subjudul "Manager - {rentang}", pemilih pond, kontrol 7/30/90 hari, kartu pH Outlet hari ini, TSS Outlet, Debit harian (otomatis) dengan "Dari {m³/s} m³/s", Curah hujan dengan jam hujan, grafik "pH Inlet vs Outlet" dengan pita baku mutu pond dan titik abnormal, kartu "Sisa stok koagulan (kg)" berupa batang. Skala batang: sisa terkini dibanding sisa tertinggi jenis itu di rentang terpilih, dengan keterangan skalanya. Hari tanpa data jadi celah di garis, bukan nol. Tanpa data sama sekali di rentang: pesan kosong dengan langkah berikut, tanpa grafik.

**Input (hub):** tiga modul dengan status hari ini ("Sudah diisi" atau "Belum diisi"), pemilih tanggal dan pond.

**Input Cuaca:** tanggal, pond, Curah hujan (Rainfall mm, Rain hours jam), banner info "Data langsung masuk laporan. Dapat diedit kapan saja tanpa approval", tombol "Simpan data cuaca".

**Input Air Permukaan:** kontrol Inlet/Outlet, pH, TSS, "Debit (per detik)" m³/s, "Debit harian" otomatis m³/d, pesan "Di luar baku mutu {min}-{maks}" di bawah kolom abnormal, banner peringatan "Nilai abnormal hanya disorot. Data tetap tersimpan, tidak diblokir", tombol **"Simpan data air"** yang menyimpan Inlet dan Outlet sekaligus dalam satu baris (API tidak diubah).

**Input Koagulan:** satu kartu per jenis (Kapur, Tawas Serbuk, Tawas Batu), "Stok awal {n} kg" dari sisa hari sebelumnya, In, Out, Sisa (otomatis; boleh ditimpa), peringatan bila negatif, tombol "Simpan data koagulan".

**Riwayat:** daftar per tanggal dan pond dengan nilai abnormal tersorot dan penanda stok berbeda, sentuh baris untuk membuka layar input hari itu. Filter tanggal dan pond.

**Akun:** profil, peran, Keluar, menu sesuai peran (bagian 2).

**Master Data Settling Pond (Admin):** tombol "Tambah Settling Pond", daftar (ikon tetes, "{kode} {nama}", koordinat, chip Aktif atau Nonaktif, tombol ubah), formulir Ubah/Tambah: Kode, Nama, Latitude, Longitude, Baku mutu (pH minimum, pH maksimum, TSS maksimum dengan placeholder "[isi sesuai izin lingkungan]"), saklar "Settling Pond aktif", Batal, Simpan.

**Kelola Pengguna (Admin):** pencarian nama atau email, filter peran, hitungan "{n} pengguna", tombol Tambah (formulir nama, email, kata sandi, peran), baris dengan inisial berwarna menurut peran, badge peran, saklar aktif, ganti peran, atur ulang kata sandi, kartu "Hak akses peran" sesuai Figma tetapi kolom Admin bercentang pada semua fungsi dan catatan "Admin punya akses penuh".

Teks UI Bahasa Indonesia, kalimat huruf kecil kecuali awal, tombol berupa kata kerja ("Simpan data cuaca", bukan "Submit"), pesan galat menyebut apa yang salah dan cara memperbaikinya.

## 6. Data dan API

Migrasi `0002`:
- `settling_ponds` tambah `code TEXT`, `latitude REAL`, `longitude REAL`.
- Tabel baru `pond_thresholds(sp_id, key, min, max, PRIMARY KEY(sp_id,key))` dengan kunci `ph_outlet` dan `tss_outlet`. Tabel `thresholds` global dihapus (hanya berisi data uji). Baku mutu hanya untuk outlet, sesuai Figma.
- `users` tambah `is_active INTEGER NOT NULL DEFAULT 1`.

Perilaku:
- `GET /ponds` mengembalikan `code, latitude, longitude, thresholds` per pond. `POST` dan `PATCH /ponds` menerima bidang itu. Hanya Admin menulis.
- Rute `/thresholds` dihapus.
- Pengguna nonaktif tidak bisa masuk (401 dengan pesan jelas), semua sesinya dihapus saat dinonaktifkan, dan sesinya tidak lagi sah. Admin aktif terakhir tidak boleh dinonaktifkan atau diturunkan perannya (409). Admin tidak boleh menonaktifkan dirinya sendiri.
- `GET /dashboard?sp=&days=7|30|90&date=`: nilai pada `date`, deret harian pH inlet dan outlet, curah hujan pada `date`, sisa terkini dan sisa tertinggi per jenis koagulan, baku mutu pond. Jumlah query tetap kecil.
- Pesan galat API diterjemahkan ke Bahasa Indonesia.
- Beranda Operator memakai `/day` yang sudah ada.

`packages/shared`: `formatNumber(n, maxDecimals)` dan `formatDateId(date)` berlokal id-ID (`1.278,7`, `12,5`, `Senin, 2 Nov 2026`). Kunci baku mutu menjadi `ph_outlet` dan `tss_outlet`. Data di database tetap angka biasa. Input menerima koma atau titik sebagai desimal.

## 7. Pengujian dan verifikasi

Uji unit shared (format, kunci). Uji API (migrasi, pond, baku mutu per pond, pengguna nonaktif dan admin terakhir, dashboard, query count, pesan Indonesia). Uji web (komponen kunci, navigasi per peran, Beranda, tiga form input, dashboard dan grafik, Master, Pengguna). Setelah selesai: build, jalankan `wrangler dev`, klik setiap tombol per peran, cek lebar 360px, laporan Delivery Gate antislop dengan bukti.

## 8. Asumsi

- Baku mutu hanya menyorot outlet. Inlet tidak disorot.
- TSS maksimum kosong berarti tidak ada batas.
- Pemilihan pond terakhir disimpan di peramban (localStorage) per perangkat.
- Warna Figma dipakai persis (lihat bagian 3).
