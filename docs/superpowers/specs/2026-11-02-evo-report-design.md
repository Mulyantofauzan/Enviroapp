# ENVIRO Bagian 4: Laporan dan ekspor Excel/PDF

Melanjutkan `2026-11-02-evo-evidence-design.md`. Desain acuan: `Design/Laporan & Ekspor.png`. PRD 3.5: "Ekspor data tabular ke Microsoft Excel (.xlsx) dan PDF". Antislop mode "selama bekerja" berlaku.

## 1. Cakupan

**Masuk:** layar Laporan (`/laporan`) dengan filter Lokasi, Periode, pilihan data, pratinjau tabel, dan dua tombol ekspor; berkas `.xlsx` dan `.pdf` dibuat di peramban; tab dan tautan navigasi.

**Masuk (tambahan pemilik produk):** grafik di layar Laporan (curah hujan, air permukaan, penggunaan koagulan), grafik itu juga di berkas PDF, dan label data pada semua grafik (juga grafik dashboard).

**Tidak masuk:** grafik di berkas Excel (Excel tetap tabel), laporan terjadwal atau lewat surel, ekspor luring (bagian 5), ekspor eviden (sudah ada di layar Eviden).

## 2. Keputusan pemilik produk

- Akses: Manager, Admin, dan Auditor. Operator tetap hanya Riwayat.
- Berkas dibuat di peramban, pustaka berat dimuat hanya saat dibutuhkan. Tidak ada endpoint API baru.
- Isi berkas mengikuti Figma: Cuaca, Air Permukaan, Koagulan, Event.
- Grafik: tampil di layar dan PDF, tidak di Excel. "Penggunaan Tawas" = Tawas Serbuk + Tawas Batu digabung (kg); Kapur hanya di grafik per jenis.

## 3. Layar

Rute `/laporan`, `RequireRole` untuk Manager, Admin, Auditor. Kepala "Laporan" dengan subjudul "Tarik data dan unduh untuk presentasi".

- **Lokasi:** satu pond atau "Semua lokasi" (awal: pond yang sedang aktif di aplikasi, seperti Figma). Cuaca berlaku untuk seluruh situs, jadi filter lokasi tidak mengubahnya (catatan kecil di bawah chip Cuaca bila satu pond dipilih).
- **Periode:** pilihan cepat (7 hari, 30 hari, Bulan ini, Bulan lalu; awal 7 hari) dan "Atur sendiri" dengan kolom Dari dan Sampai. Rentang maksimal 366 hari (inklusif), dari lebih kecil atau sama dengan sampai; pelanggaran menampilkan pesan dan menonaktifkan ekspor.
- **Data yang disertakan:** chip beralih Cuaca, Air Permukaan, Koagulan, Event (awal: tiga pertama aktif, Event mati seperti Figma). Minimal satu aktif; chip terakhir tidak bisa dimatikan.
- **Pratinjau:** kontrol pilihan antar bagian yang aktif, tabel `DataTable` yang sama dengan Riwayat (sel di luar baku mutu merah), paling banyak 50 baris dengan keterangan "Pratinjau 50 dari 214 baris". Catatan di bawah tabel: "Debit harian dihitung otomatis dari m³/s. Sel merah menandai nilai di luar baku mutu."
- **Tombol:** "Ekspor Excel (.xlsx)" (utama) dan "Ekspor PDF" (garis tepi). Nonaktif saat memuat, tanpa baris sama sekali, atau rentang tidak sah; saat membuat berkas tombol menampilkan "Menyiapkan…".
- **Keadaan:** memuat ("Memuat data…", untuk Event "Memuat event 2 dari 5"), kosong ("Tidak ada data pada periode ini."), galat dengan sebab (galat jendela Event menyebut rentang tanggal jendela itu).

## 4. Data

Tanpa API baru.

- Cuaca, Air, Koagulan: `GET /history?from&to[&sp]` (rentang ≤ 366 hari sudah ditegakkan API; tanggal WITA).
- Event: `GET /events?from&to[&sp]` dibatasi API 62 hari, jadi klien membagi periode menjadi jendela berurutan sepanjang ≤ 62 hari (maksimal enam) dan menggabungkan hasilnya, urut tenggat naik. Pengambilan berurutan, bukan paralel. Perubahan filter atau chip membatalkan hasil yang terlambat (nomor generasi, seperti `useEvidenceList`).
- Data dimuat sekali per kombinasi Lokasi dan Periode; chip hanya memilih tampilan dan isi berkas. Event hanya dimuat bila chip Event pernah aktif.

**Model tabel** (fungsi murni `buildReport`, tanpa React): menerima hasil `/history`, event, daftar pond, pilihan, dan keterangan (lokasi, periode, pembuat, waktu buat) lalu menghasilkan bagian-bagian `{ id, title, columns[{key,header,kind:'text'|'number',decimals?}], rows[{cells,bad:Set<key>}] }`. Satu sumber untuk pratinjau, Excel, dan PDF sehingga ketiganya tidak bisa berselisih.

| Bagian | Kolom |
|---|---|
| Cuaca | Tanggal, Rainfall (mm), Rain hours (jam) |
| Air Permukaan | Tanggal, Pond, pH inlet, pH outlet, TSS inlet (mg/L), TSS outlet (mg/L), Debit inlet (m³/d), Debit outlet (m³/d) |
| Koagulan | Tanggal, Pond, Jenis, Masuk, Keluar, Sisa, Catatan (kosong, atau "Selisih stok") |
| Event | Tenggat, Judul, Frekuensi, Lokasi, Status, Diselesaikan oleh, Waktu selesai (WITA), Jumlah eviden |

Aturan: tanggal terbaru di atas seperti Riwayat; sel kosong tampil `–` di tabel dan PDF, dan sel benar-benar kosong di Excel; "bad" memakai `isOutOfLimit` dengan baku mutu pond itu (hanya kolom outlet, seperti Riwayat); status event: Selesai, Selesai (terlambat), Overdue, Hari ini, Mendatang; lokasi event tanpa pond tampil "Semua lokasi".

## 4b. Grafik

Grafik mengikuti chip: chip Cuaca menampilkan grafik curah hujan, Air Permukaan grafik air, Koagulan grafik koagulan; Event tanpa grafik. Letaknya di bawah pratinjau tabel, urut seperti di bawah. Setiap grafik punya judul, satuan, dan keterangan teks (nilai tertinggi, terendah, terakhir) agar tidak hanya bergantung warna; bila datanya kosong grafik menampilkan "Belum ada data pada rentang ini." bukan sumbu kosong.

Dua jenis jendela:
- **Mengikuti Periode** (awal 7 hari): grafik harian air dan koagulan.
- **Tetap terhadap hari ini** (tidak ikut Periode, tetap ikut Lokasi): 1 minggu curah hujan, 5 minggu terakhir, 12 bulan terakhir (YTD). Datanya satu pengambilan `/history` sepanjang 366 hari berakhir hari ini (rentang yang sudah diizinkan API), dimuat sekali per Lokasi; 1 minggu dan 5 minggu adalah irisannya.

| Bagian | Grafik |
|---|---|
| Curah hujan | (1) Garis curah hujan harian, 7 hari terakhir, mm. (2) Batang rata-rata curah hujan per minggu, 5 minggu terakhir, mm/hari. (3) Batang rata-rata curah hujan per bulan, 12 bulan terakhir, mm/hari. Tabel Cuaca (Rainfall dan Rain hours) tetap di pratinjau. |
| Air permukaan | (4) pH harian inlet dan outlet, dengan garis baku mutu outlet pond. (5) TSS inlet dan outlet harian, dengan garis baku mutu outlet. (6) Debit outlet harian, m³/d. Butuh satu lokasi: bila "Semua lokasi", kartu menampilkan "Pilih satu lokasi untuk melihat grafik air permukaan." |
| Koagulan | (7) Penggunaan (Out, kg) harian per jenis, batang berkelompok Kapur, Tawas Serbuk, Tawas Batu. (8) Penggunaan tawas (Serbuk + Batu), total per minggu, 5 minggu terakhir, kg. (9) Penggunaan tawas, total per bulan, 12 bulan terakhir, kg. Dengan "Semua lokasi" jumlah dijumlahkan lintas pond. |

Aturan hitung (fungsi murni di `lib/aggregate.ts`):
- **Minggu** Senin sampai Minggu; "5 minggu terakhir" = minggu hari ini dan empat minggu sebelumnya; minggu berjalan sebagian ditandai "(berjalan)" dan hanya mencakup hari yang sudah lewat. **Bulan**: 12 bulan kalender berakhir bulan ini, bulan berjalan sebagian ditandai sama.
- **Rata-rata** = jumlah curah hujan dibagi jumlah hari yang punya data (hari tanpa data tidak dihitung nol); minggu atau bulan tanpa satu pun data = kosong (celah, bukan nol). **Total** (tawas) = jumlah `stock_out`; periode tanpa data = kosong; hari dengan data tetapi Out kosong dihitung 0.
- Hari berdasar WITA (hari ini dari server, `/events/summary`, dengan cadangan seperti Eviden).

**Label data**: semua grafik di Laporan dan di dashboard (`TrendChart`, `PhChart`, `RainChart`, `StockBars`, dan grafik baru) menampilkan angka di titik atau batang, berformat id-ID. Aturan agar tidak bertumpuk: sampai 14 titik tiap titik berlabel; lebih dari itu hanya titik pertama, terakhir, tertinggi, terendah. Label tidak keluar dari area gambar (digeser ke dalam di tepi), teks minimal 11 px, warna kontras terhadap latar, dan dua garis pada satu grafik (inlet, outlet) menaruh label di atas dan di bawah titik supaya tidak saling menutup. Jumlah desimal: 1 untuk mm dan kg, 2 untuk pH, 0 untuk TSS dan debit kecuali nilainya pecahan.

Grafik baru: `BarChart` (batang tunggal dan berkelompok, dipakai grafik 2, 3, 7, 8, 9) dan garis memakai `TrendChart` yang diperluas (grafik 1, 4, 5, 6). SVG buatan sendiri seperti yang sudah ada, tanpa pustaka grafik.

## 5. Berkas

**Excel** (`lib/xlsx.ts`, penulis kecil di atas `fflate`, tanpa pustaka tambahan): paket OOXML minimum yang sah (`[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/styles.xml`, `xl/worksheets/sheetN.xml`), string sebagai `inlineStr` (tanpa tabel string bersama), karakter XML (`& < > "`) di-escape dan karakter kontrol dibuang, nama lembar ≤ 31 karakter tanpa `[]:*?/\` dan unik. Lembar pertama "Ringkasan": judul, Lokasi, Periode, Dibuat oleh, Dibuat pada (WITA), jumlah baris per bagian. Lalu satu lembar per bagian aktif: baris judul kolom tebal berlatar hijau pucat dan dibekukan, angka sebagai angka asli dengan format `#,##0.###` atau sesuai desimal kolom, sel "bad" merah dan tebal, lebar kolom disesuaikan isi (maks 40). Nama berkas `laporan-evo-{lokasi}-{dari}-{sampai}.xlsx`, bagian lokasi dibersihkan seperti `safeEntryName`.

**PDF** (`lib/pdf.ts`): `jsPDF` dan `jspdf-autotable`, dimuat dengan `import()` saat "Ekspor PDF" ditekan (potongan kode terpisah, tidak ada di muatan awal). A4 lanskap; blok kepala sama dengan lembar Ringkasan; satu tabel per bagian dengan judul bagian, baris judul tebal berulang di tiap halaman, sel "bad" teks merah tebal dan latar merah muda, nomor halaman "Halaman x dari y" di kaki. Huruf bawaan Helvetica (cukup untuk huruf Latin dan `³`); karakter di luar jangkauan diganti `?` bukan merusak berkas. Grafik dari 4b ikut dalam PDF: tiap SVG diserialisasi, digambar ke kanvas dua kali ukuran layar, dan ditempel sebagai gambar PNG pada halaman setelah tabel bagian itu (judul grafik tetap teks PDF). Excel hanya tabel. Nama berkas sama dengan Excel, ekstensi `.pdf`.

Unduhan memakai pola yang sama dengan ZIP Eviden (`URL.createObjectURL`, anchor `download`, revoke setelah 1 detik). Jumlah baris total di seluruh bagian dibatasi 20.000; di atas itu ekspor ditolak dengan pesan menyuruh mempersempit periode (menjaga memori ponsel).

## 6. Navigasi dan hak

Manager: tab Beranda, Kalender, Laporan, Akun. Auditor: Kalender, Riwayat, Eviden, Laporan, Akun. Admin: tautan "Laporan" di menu Akun (tab sudah empat). Operator: tidak ada. Ikon baru bila perlu: `chart` atau `file` yang ada; tidak membuat ikon yang tidak dipakai.

## 7. Pengujian dan verifikasi

Uji unit: `aggregate` (rata-rata per minggu dan bulan hanya dari hari berdata, minggu dan bulan kosong jadi celah, batas minggu Senin, pergantian tahun, minggu dan bulan berjalan sebagian, jumlah tawas Serbuk + Batu tanpa Kapur, jumlah lintas pond); aturan label (sampai 14 titik semua, lebih dari itu pertama, terakhir, tertinggi, terendah, tidak keluar area); komponen grafik (label tampil, keterangan teks, keadaan kosong); `buildReport` (urutan, `–`, bad hanya outlet dengan baku mutu pond, status event, filter pond, cuaca tanpa pond); `xlsx` (dibuka kembali dengan `unzipSync`: kerangka OOXML lengkap, XML tersusun baik lewat `DOMParser`, escape karakter khusus dan karakter kontrol, angka bertipe angka, sel bad memakai gaya merah, nama lembar sah dan unik, sel kosong, nol baris); `pdf` (byte awal `%PDF`, jumlah halaman bertambah untuk banyak baris, teks judul terbaca, gambar grafik tertanam bila ada grafik); layar (akses per peran, filter memicu pengambilan yang benar, jendela Event ≤ 62 hari, chip terakhir tidak bisa mati, rentang > 366 hari, kosong dan galat, hasil terlambat dibuang, tombol nonaktif, unduhan bernama benar). Verifikasi di Chrome nyata: ekspor kedua berkas, `.xlsx` dibuka ulang dan diperiksa isinya (lembar, angka, sel merah), `.pdf` dirender dan dibaca tangkapan layarnya, 360 dan 1200 px tanpa overflow dan tanpa target < 44 px.

## 8. Asumsi

- Waktu dan tanggal di berkas WITA, angka berformat id-ID di tabel dan PDF; di Excel angka disimpan numerik dan tampil mengikuti pengaturan Excel pembukanya.
- Baku mutu diambil dari pengaturan pond saat berkas dibuat (bukan riwayat baku mutu).
- Tidak ada jejak audit untuk unduhan.
