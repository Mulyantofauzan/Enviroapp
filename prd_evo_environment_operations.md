# Product Requirements Document (PRD)

**Product Name:** ENVIRO (Environmental Information & Reporting Operations)
**Platform:** Mobile-First (Mobile App & Desktop Web)
**Document Status:** Final Draft v2

## 1. Ringkasan Eksekutif (Executive Summary)

**ENVIRO (Environmental Information & Reporting Operations)** adalah platform *mobile-first* yang dikembangkan untuk mendigitalisasi operasional dan pemantauan lingkungan. Aplikasi ini berfokus pada pencatatan parameter cuaca, kualitas air permukaan, konsumsi koagulan, dan kepatuhan jadwal kegiatan lingkungan (*Enviro Events*). Dibangun dengan arsitektur modern dan infrastruktur Cloudflare, ENVIRO menjamin performa cepat, stabilitas di area minim sinyal (*Offline-Sync*), serta memberikan keleluasaan bagi tim lapangan untuk beroperasi tanpa hambatan birokrasi sistem yang kaku.

## 2. Target Pengguna & Hak Akses (User Roles)

Sistem ini menggunakan *Role-Based Access Control* (RBAC) yang praktis:
* **Admin System:** Mengelola akun, akses pengguna, dan konfigurasi master data (termasuk master data Settling Pond).
* **Manager/Supervisor:** Mengatur jadwal kalender kegiatan, memantau *dashboard* analitik, dan menarik laporan presentasi.
* **Operator Lapangan:** Mencatat data harian lingkungan, penggunaan bahan kimia, dan mengeksekusi jadwal kegiatan (unggah eviden). Data bersifat *editable* secara langsung tanpa perlu proses *approval*.
* **Auditor (Read-Only):** Mengakses kalender, melihat historis data, dan mengunduh bukti eviden lapangan.

## 3. Spesifikasi Fitur Utama (Functional Requirements)

### 3.1. Modul Pemantauan Lingkungan, Cuaca & Koagulan
Modul *data entry* yang cepat dan responsif untuk rutinitas harian dengan dukungan multi-lokasi (Settling Pond/SP).

* **Manajemen Multi-Lokasi (Settling Ponds):** Sistem mendukung pencatatan untuk lebih dari satu Settling Pond. Operator memilih SP mana yang sedang diukur sebelum memasukkan data.
* **Pencatatan Cuaca (Weather):** Form terpisah untuk pencatatan *Rainfall* (Curah hujan) dan *Rain hours* (Jam hujan).
* **Parameter Air Permukaan (Inlet & Outlet):** 
  * Pencatatan spesifik untuk titik **Inlet** dan **Outlet** meliputi parameter pH, TSS, dan Debit air.
  * **Auto-Calculate Debit:** Operator hanya perlu memasukkan satuan debit per detik (m³/s). Sistem akan otomatis menghitung dan menampilkan debit harian (m³/d) pada *dashboard* dan laporan akhir (tidak perlu kalkulasi manual).
* **Penggunaan Koagulan (Inventory Control):** Pencatatan untuk Kapur, Tawas Serbuk, dan Tawas Batu menggunakan format kontrol inventaris:
  * **In:** Jumlah barang masuk/restock.
  * **Out:** Jumlah barang yang digunakan.
  * **Remaining:** Kalkulasi sisa stok secara otomatis.
* **Visual Warning (Abnormalitas):** Sistem tidak akan memblokir input jika ada data yang di luar baku mutu. Aplikasi hanya memberikan **sorotan warna latar belakang (background highlight)** pada angka abnormal, namun data tetap tersimpan.
* **Direct-to-Report & Editable:** Data langsung memperbarui laporan *real-time*. Operator diizinkan mengedit data kapan saja (*No Audit Trail required*).

### 3.2. Mode Luring & Sinkronisasi (Offline Mode & Sync)
* **Local Storage Entry:** Pengguna tetap dapat membuka form, mengisi data, dan memotret eviden saat tidak ada internet.
* **Auto-Sync:** Aplikasi akan mengunggah data dalam antrean (queue) secara otomatis begitu *smartphone* mendapatkan koneksi internet.

### 3.3. Kalender Event Enviro (Task & Compliance Tracker)
* **Frekuensi Jadwal:** Mendukung penjadwalan Harian, Mingguan, Bulanan, 3-Bulanan, 6-Bulanan, dan Tahunan.
* **Penanganan *Overdue*:** Jadwal yang melewati tenggat waktu akan ditandai dengan **warna merah**. Jadwal ini **tidak akan hilang**, melainkan terus menuntut pengguna menyelesaikannya dengan mengunggah eviden.

### 3.4. Manajemen Eviden (Bukti Lapangan)
* **Kamera Terintegrasi (Live Camera):** Mengambil foto langsung via aplikasi yang otomatis membubuhkan **Geotagging (Koordinat GPS)** dan **Timestamp (Waktu & Tanggal)**.
* **Opsi Unggah Manual & Akses:** Tersedia opsi unggah file/galeri. Semua eviden bisa diunduh atau dipratinjau dengan mudah (1-2 klik).

### 3.5. Pelaporan & Ekspor Data (Reporting)
* **Dashboard Visual:** Grafik interaktif (garis/batang) untuk pergerakan pH, debit, atau stok koagulan.
* **Export Tools:** Ekspor data tabular ke **Microsoft Excel (.xlsx)** dan **PDF**. 

## 4. Kebutuhan Non-Fungsional (Teknis & Arsitektur)

* **Frontend:** *React Native* atau *Flutter* (Mobile-first, Web-App ready).
* **Backend:** *Go (Golang)* atau *Node.js* (Hono/Fastify).
* **Infrastruktur & Cloudflare:** Menggunakan *Cloudflare DNS, CDN*, dan *Cloudflare R2 Storage* (untuk penyimpanan file foto/PDF yang efisien dan tanpa biaya egress).
* **Database:** *PostgreSQL*.

---

## 5. Desain Database (Schema/ERD)

Desain database dioptimalkan untuk skalabilitas, penggunaan tipe data yang akurat (Decimal untuk pengukuran), dan relasi yang memisahkan cuaca dengan kualitas air di tiap Settling Pond.

### 1. `Users`
Manajemen akun pengguna dan *role* (RBAC).
* `id` (UUID, Primary Key)
* `name` (Varchar)
* `email` (Varchar, Unique)
* `password_hash` (Varchar)
* `role` (Enum: 'Admin', 'Manager', 'Operator', 'Auditor')

### 2. `Settling_Ponds`
Master data untuk mendukung banyak lokasi Settling Pond (SP 1, SP 2, dst).
* `id` (UUID, Primary Key)
* `name` (Varchar) - *Contoh: "SP 1", "SP 2"*
* `is_active` (Boolean)

### 3. `Weather`
Pencatatan cuaca harian (dipisah dari kualitas air karena cuaca berlaku untuk area secara umum, bukan per SP).
* `id` (UUID, Primary Key)
* `date` (Date)
* `rainfall_mm` (Decimal)
* `rain_hours` (Decimal)
* `logged_by` (UUID, FK -> Users.id)

### 4. `Surface_Water`
Pencatatan kualitas dan debit air, direlasikan spesifik ke setiap Settling Pond.
* `id` (UUID, Primary Key)
* `date` (Date)
* `sp_id` (UUID, FK -> Settling_Ponds.id)
* `ph_inlet` (Decimal)
* `ph_outlet` (Decimal)
* `tss_inlet` (Decimal)
* `tss_outlet` (Decimal)
* `debit_inlet_m3s` (Decimal) - *Input manual. (m3/d dihitung oleh sistem: m3/s * 86400)*
* `debit_outlet_m3s` (Decimal) - *Input manual.*
* `logged_by` (UUID, FK -> Users.id)

### 5. `Coagulant`
Pencatatan kontrol inventaris (In/Out/Remaining) untuk bahan kimia di setiap Settling Pond.
* `id` (UUID, Primary Key)
* `date` (Date)
* `sp_id` (UUID, FK -> Settling_Ponds.id)
* `type` (Enum: 'Tawas Serbuk', 'Tawas Batu', 'Kapur')
* `stock_in` (Decimal) - *Barang masuk*
* `stock_out` (Decimal) - *Barang dipakai*
* `stock_remaining` (Decimal) - *Sisa akhir*
* `logged_by` (UUID, FK -> Users.id)

### 6. `Enviro_Events`
Kalender kepatuhan dan jadwal.
* `id` (UUID, Primary Key)
* `title` (Varchar)
* `frequency` (Enum: 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual')
* `due_date` (Date)
* `status` (Enum: 'To-Do', 'In Progress', 'Completed', 'Overdue')
* `assigned_to` (UUID, FK -> Users.id, Nullable)

### 7. `Evidences`
Penyimpanan bukti operasional/event. Wajib menyimpan data geospasial untuk validitas audit.
* `id` (UUID, Primary Key)
* `event_id` (UUID, FK -> Enviro_Events.id)
* `file_url` (Varchar) - *URL ke Cloudflare R2*
* `gps_latitude` (Decimal 10,8)
* `gps_longitude` (Decimal 11,8)
* `timestamp_taken` (Timestamp)
* `uploaded_by` (UUID, FK -> Users.id)

---

## 6. Panduan Desain UI/UX

* **Estetika Visual:** Menggunakan gaya yang mengalir, *rounded corners*, dan warna *earth-tone* (hijau alami). Menghindari desain generik/kaku.
* **Ergonomi Mobile:** Input form memanfaatkan *numpad* yang responsif. Tombol *Submit* dan akses kamera diposisikan di *thumb-zone* (area bawah layar).
* **Indikator Visual:** Menggunakan latar belakang warna cerah/merah muda untuk input angka di luar rentang normal, serta teks warna merah tegas untuk jadwal kalender yang *Overdue*.