# EVO Bagian 4: Laporan dan ekspor Excel/PDF

Melanjutkan `2026-11-02-evo-evidence-design.md`. Desain acuan: `Design/Laporan & Ekspor.png`. PRD 3.5: "Ekspor data tabular ke Microsoft Excel (.xlsx) dan PDF". Antislop mode "selama bekerja" berlaku.

## 1. Cakupan

**Masuk:** layar Laporan (`/laporan`) dengan filter Lokasi, Periode, pilihan data, pratinjau tabel, dan dua tombol ekspor; berkas `.xlsx` dan `.pdf` dibuat di peramban; tab dan tautan navigasi.

**Tidak masuk:** grafik di dalam berkas, laporan terjadwal atau lewat surel, ekspor luring (bagian 5), ekspor eviden (sudah ada di layar Eviden).

## 2. Keputusan pemilik produk

- Akses: Manager, Admin, dan Auditor. Operator tetap hanya Riwayat.
- Berkas dibuat di peramban, pustaka berat dimuat hanya saat dibutuhkan. Tidak ada endpoint API baru.
- Isi berkas mengikuti Figma: Cuaca, Air Permukaan, Koagulan, Event.

## 3. Layar

Rute `/laporan`, `RequireRole` untuk Manager, Admin, Auditor. Kepala "Laporan" dengan subjudul "Tarik data dan unduh untuk presentasi".

- **Lokasi:** satu pond atau "Semua lokasi" (awal: "Semua lokasi"). Cuaca berlaku untuk seluruh situs, jadi filter lokasi tidak mengubahnya (catatan kecil di bawah chip Cuaca bila satu pond dipilih).
- **Periode:** pilihan cepat (7 hari, 30 hari, Bulan ini, Bulan lalu; awal 30 hari) dan "Atur sendiri" dengan kolom Dari dan Sampai. Rentang maksimal 366 hari (inklusif), dari lebih kecil atau sama dengan sampai; pelanggaran menampilkan pesan dan menonaktifkan ekspor.
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

## 5. Berkas

**Excel** (`lib/xlsx.ts`, penulis kecil di atas `fflate`, tanpa pustaka tambahan): paket OOXML minimum yang sah (`[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/styles.xml`, `xl/worksheets/sheetN.xml`), string sebagai `inlineStr` (tanpa tabel string bersama), karakter XML (`& < > "`) di-escape dan karakter kontrol dibuang, nama lembar ≤ 31 karakter tanpa `[]:*?/\` dan unik. Lembar pertama "Ringkasan": judul, Lokasi, Periode, Dibuat oleh, Dibuat pada (WITA), jumlah baris per bagian. Lalu satu lembar per bagian aktif: baris judul kolom tebal berlatar hijau pucat dan dibekukan, angka sebagai angka asli dengan format `#,##0.###` atau sesuai desimal kolom, sel "bad" merah dan tebal, lebar kolom disesuaikan isi (maks 40). Nama berkas `laporan-evo-{lokasi}-{dari}-{sampai}.xlsx`, bagian lokasi dibersihkan seperti `safeEntryName`.

**PDF** (`lib/pdf.ts`): `jsPDF` dan `jspdf-autotable`, dimuat dengan `import()` saat "Ekspor PDF" ditekan (potongan kode terpisah, tidak ada di muatan awal). A4 lanskap; blok kepala sama dengan lembar Ringkasan; satu tabel per bagian dengan judul bagian, baris judul tebal berulang di tiap halaman, sel "bad" teks merah tebal dan latar merah muda, nomor halaman "Halaman x dari y" di kaki. Huruf bawaan Helvetica (cukup untuk huruf Latin dan `³`); karakter di luar jangkauan diganti `?` bukan merusak berkas. Nama berkas sama dengan Excel, ekstensi `.pdf`.

Unduhan memakai pola yang sama dengan ZIP Eviden (`URL.createObjectURL`, anchor `download`, revoke setelah 1 detik). Jumlah baris total di seluruh bagian dibatasi 20.000; di atas itu ekspor ditolak dengan pesan menyuruh mempersempit periode (menjaga memori ponsel).

## 6. Navigasi dan hak

Manager: tab Beranda, Kalender, Laporan, Akun. Auditor: Kalender, Riwayat, Eviden, Laporan, Akun. Admin: tautan "Laporan" di menu Akun (tab sudah empat). Operator: tidak ada. Ikon baru bila perlu: `chart` atau `file` yang ada; tidak membuat ikon yang tidak dipakai.

## 7. Pengujian dan verifikasi

Uji unit: `buildReport` (urutan, `–`, bad hanya outlet dengan baku mutu pond, status event, filter pond, cuaca tanpa pond); `xlsx` (dibuka kembali dengan `unzipSync`: kerangka OOXML lengkap, XML tersusun baik lewat `DOMParser`, escape karakter khusus dan karakter kontrol, angka bertipe angka, sel bad memakai gaya merah, nama lembar sah dan unik, sel kosong, nol baris); `pdf` (byte awal `%PDF`, jumlah halaman bertambah untuk banyak baris, teks judul terbaca); layar (akses per peran, filter memicu pengambilan yang benar, jendela Event ≤ 62 hari, chip terakhir tidak bisa mati, rentang > 366 hari, kosong dan galat, hasil terlambat dibuang, tombol nonaktif, unduhan bernama benar). Verifikasi di Chrome nyata: ekspor kedua berkas, `.xlsx` dibuka ulang dan diperiksa isinya (lembar, angka, sel merah), `.pdf` dirender dan dibaca tangkapan layarnya, 360 dan 1200 px tanpa overflow dan tanpa target < 44 px.

## 8. Asumsi

- Waktu dan tanggal di berkas WITA, angka berformat id-ID di tabel dan PDF; di Excel angka disimpan numerik dan tampil mengikuti pengaturan Excel pembukanya.
- Baku mutu diambil dari pengaturan pond saat berkas dibuat (bukan riwayat baku mutu).
- Tidak ada jejak audit untuk unduhan.
