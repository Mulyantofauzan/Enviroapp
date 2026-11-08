# ENVIRO Bagian 4b: PDF laporan bergaya slide (Cuaca dan Pond)

Menggantikan bagian PDF di `2026-11-02-evo-report-design.md` (bagian 5, "PDF", dan penyertaan grafik layar ke PDF). Desain acuan: `Design/Laporan Cuaca.pdf` dan `Design/Laporan pond.pdf`. Antislop mode "selama bekerja" berlaku.

## 1. Cakupan

**Masuk:** ekspor PDF baru yang digambar langsung dari data (tanpa memotret grafik dari layar): satu halaman Cuaca, satu halaman per pond, satu halaman tabel Event bila chip Event aktif; satu endpoint API untuk total tawas seumur data.

**Tidak masuk:** perubahan pada layar Laporan, grafik layar, ekspor Excel; kolom Shift DS/NS; logo; batang oranye di kiri, footer "trusted | reliable | dependable", kotak nomor halaman oranye (semuanya diminta dibuang pemilik produk).

## 2. Keputusan pemilik produk

- PDF yang sekarang diganti seluruhnya oleh desain ini.
- Grafik 1 bulan dan 1 tahun di PDF memakai total curah hujan dan jam hujan (sesuai desain), bukan rata-rata. Layar Laporan tetap rata-rata.
- Tanpa kolom Shift dan tanpa logo.
- Project To Date dihitung dari seluruh data lewat endpoint baru.
- Judul halaman pond: `{kode} {nama}` pond huruf besar + " MONITORING" (mis. "SP 11 LGG MONITORING"); tanpa kode, nama saja. Halaman cuaca: "WEATHER MONITORING".

## 3. Struktur berkas

A4 landscape (842 x 595 pt), margin 28 pt, huruf Helvetica. Urutan halaman: Cuaca (chip Cuaca aktif); lalu satu halaman per pond berurutan menurut kode (chip Air atau Koagulan aktif; "Semua lokasi" = semua pond aktif yang punya data dalam setahun terakhir, satu pond terpilih = satu halaman); lalu tabel Event (chip Event aktif; tabel biasa bergaya lama, judul "EVENT", baris judul berulang, "Halaman x dari y" di kaki hanya pada halaman tabel ini). Bila tak ada halaman sama sekali (misalnya hanya Event tanpa baris) PDF tetap sah dengan satu halaman berisi "Tidak ada data pada periode ini.".

Semua jendela waktu berakhir di **tanggal akhir Periode** yang dipilih (`to`): "harian" = 7 hari berakhir `to`, "mingguan" = 5 minggu ISO (Senin-Minggu) yang minggu terakhirnya memuat `to`, "bulanan" = 12 bulan kalender yang bulan terakhirnya memuat `to`. Minggu atau bulan terakhir bisa sebagian; hari setelah `to` tidak dihitung. Saat ekspor, aplikasi mengambil `/history` dari `to` dikurangi 365 hari sampai `to` (satu permintaan, tanpa `sp` bila "Semua lokasi", dikelompokkan per pond di klien) dan, untuk halaman pond, total seumur data (bagian 6). Bila `to` sama dengan hari ini, tetap pengambilan terpisah (PDF tidak bergantung pada data layar).

Format: angka id-ID (`10,5`, `4.000`); tanggal tabel dan sumbu harian `19-Oct`; sumbu bulanan `Aug`; nama bulan Inggris tiga huruf di seluruh halaman slide agar sejalan dengan judul berbahasa Inggris seperti desain; minggu `W39` (nomor minggu ISO).

## 4. Halaman Cuaca ("WEATHER MONITORING")

Banner judul di tengah atas (lebar 300 pt, tinggi 30 pt, latar merah `#B02318`, teks putih abu tebal miring 17 pt).

**Tabel** (7 hari, tanggal terbaru di bawah seperti desain, dari `to - 6` sampai `to`): kolom Date | Weather: Rainfall (mm), Duration (hrs), Intensity (mm/hrs). Kepala dua tingkat berlatar merah tua, teks putih tebal miring. Sel Rainfall dan Duration berlatar persik `#F3CDB8`, kolom Date putih, kolom Intensity berlatar persik dengan teks merah. Angka satu desimal (`0,0`). Intensity harian = rainfall / jam hujan, `0,0` bila jam hujan 0. Hari tanpa data tampil `0,0` (seperti desain). **Baris ringkasan** berlatar kuning `#F5B83D`, tebal: "{n} hari hujan" (hari dengan rainfall > 0) | total mm + " mm" | total jam + " hrs" | intensity tertinggi + " mm/hrs".

**Tiga grafik** berdampingan di bawah tabel, tiap panel berlatar persik `#F8E4D8` berbingkai merah `#D9261C`, judul sebagai label merah `#E5322D` bertulisan putih tebal di tengah atas panel:
- "Rainfall (1W)": 7 hari harian. Garis merah `#E5322D` = rainfall (sumbu kiri, mm), garis biru tua `#14306B` = Duration (sumbu kanan, hrs).
- "Rainfall (1M)": 5 minggu (W..), total rainfall per minggu dan total jam hujan per minggu.
- "Rainfall (1Y)": 12 bulan, "Total Rainfall (mm)" dan "Rain hours (hrs)" per bulan.
Tiap titik berlabel kotak berwarna (merah untuk rainfall, biru tua untuk jam) bertulis putih; legenda di bawah panel (dua entri, garis berwarna). Periode tanpa data: tidak ada titik dan garis terputus (bukan nol); bila seluruh seri kosong, panel menampilkan "No data" di tengah.

## 5. Halaman pond ("{KODE NAMA} MONITORING")

Banner biru tua `#14306B`, teks putih. Tata letak dua kolom: kiri dua panel di atas dua panel (2 x 2), kanan kolom ringkasan koagulan. Panel berlatar hijau pucat `#D6E8C2` berbingkai hijau `#7DB04B`, judul label biru tua bertulisan putih.

**Grafik harian (7 hari berakhir `to`)**
- "pH Monitoring": batang berkelompok pH Inlet (biru tua) dan pH Outlet (kuning `#F5B83D`); dua garis merah horizontal "pH Min" dan "pH Max" dari baku mutu `ph_outlet` pond (bila pond tidak punya baku mutu tidak ada garis dan tidak ada legenda garis); label angka di atas batang.
- "TSS Monitoring": batang TSS inlet (kuning) dan TSS outlet (biru tua), satu garis merah "BML MHU" dari batas maksimum `tss_outlet` (bila ada), legenda "TSS inlet (mg/l)", "TSS outlet (mg/l)", "BML MHU".
- "Debit Inlet & Outlet": batang debit inlet (biru muda `#4A90D9`) dan debit outlet (hitam `#1A1A1A`) dalam L/s (m3/hari dibagi 86,4), satu desimal, legenda "Debit Inlet (L/S)", "Debit Outlet (L/S)".
- "Jenis & Qty Koagulan (kg)": batang Tawas Batu (biru tua) dan Tawas Serbuk (kuning) per hari (kg keluar, jumlah bila ada beberapa baris); Kapur tidak ditampilkan.
Hari tanpa data: tanpa batang; label "0" hanya untuk nilai nol yang tercatat.

**Kolom kanan "Summary Penggunaan Koagulan"** (kepala biru tua, teks putih tebal miring)
- Tabel WEEKLY (kepala W..): "Total Tawas (kg)" = Serbuk + Batu keluar dalam minggu itu; "Total (karung)" = kg / 25; "Average per day (kg)" = total / 7 (minggu berjalan: dibagi jumlah hari yang sudah lewat sampai `to`). Karung dan rata-rata dibulatkan sampai satu desimal tanpa nol di belakang. 5 minggu.
- Grafik garis "Penggunaan Koagulan MTD": total tawas per minggu (5 titik, berlabel).
- Tabel MONTHLY: bulan (5 bulan berakhir bulan `to`), "Total (kg)", "Total (karung)".
- Grafik garis "Grafik Koagulan YTD": total tawas per bulan, 12 bulan, berlabel.
- Dua kotak: "Year To Date" (total kg dan karung dari 1 Januari tahun `to` sampai `to`) dan "Project To Date" (total kg dan karung seumur data sampai `to`).
Tawas = Tawas Serbuk + Tawas Batu; satu karung = 25 kg (konstanta bernama).

## 6. API

`GET /history/coagulant-total?to=YYYY-MM-DD[&sp=ID]`, semua peran yang masuk. Mengembalikan `{ ponds: [{ sp_id, first_date, "Tawas Serbuk": kg, "Tawas Batu": kg, Kapur: kg }] }`: jumlah `stock_out` per pond dan jenis untuk tanggal <= `to` (kosong dihitung 0), `first_date` = tanggal catatan pertama pond itu atau null. `to` tidak sah atau lebih dari satu tahun di masa depan -> 400 berpesan Indonesia. Satu query agregat (`GROUP BY sp_id, type`), tanpa pengulangan per baris.

## 7. Teknis

- `lib/pdf/dates.ts`: `isoWeek(date): number`, jendela harian, mingguan (5), bulanan (12) terhadap `to`.
- `lib/pdf/pages.ts` (murni): `weatherPage(entries, to)` dan `pondPage(entries, pond, to, totals)` mengembalikan model data lengkap (angka sudah dihitung, ringkasan, deret grafik); tanpa DOM.
- `lib/pdf/svg.ts` (murni): `lineChartSvg`, `barChartSvg` menghasilkan string SVG mandiri (warna sebagai atribut, tanpa kelas CSS) lengkap dengan panel, label judul, label data, legenda; dirasterkan dengan `svgToPng` yang sudah ada (skala 3) dan ditempel dengan `addImage`.
- `lib/pdf/slides.ts`: `buildSlidePdf(input)` menyusun halaman dengan `jspdf` (dan `jspdf-autotable` untuk tabel Cuaca, ringkasan, dan Event); `lib/pdf.ts` lama dihapus bersama `PdfChart`, `chartImage.serializeChart` untuk halaman layar, dan pengumpulan SVG dari DOM di `Laporan.tsx`.
- Teks di luar jangkauan Helvetica diganti `?` seperti sekarang (`pdfSafe`).
- Pustaka PDF tetap dimuat hanya saat tombol ditekan.
- Nama berkas tetap `laporan-evo-{lokasi}-{dari}-{sampai}.pdf`.

## 8. Pengujian dan verifikasi

Uji unit: `isoWeek` (batas tahun: 2026-01-01 ada di minggu 1 atau 53 sesuai ISO, 2024-12-30 minggu 1), jendela mingguan dan bulanan (batas tahun, minggu dan bulan berjalan), `weatherPage` (intensity, hari hujan, intensity tertinggi, hari tanpa data, ringkasan nol), `pondPage` (kg ke karung, rata-rata per hari untuk minggu penuh dan berjalan, tawas tanpa Kapur, debit ke L/s, garis batas hanya bila ada baku mutu, YTD mulai 1 Januari, Project To Date dari total), SVG (terbaca `DOMParser`, jumlah label, garis batas, seri kosong, karakter khusus ter-escape, tanpa kelas CSS), PDF (jumlah halaman: Cuaca + N pond + Event; judul "SP 11 LGG MONITORING"; "Semua lokasi" satu halaman per pond; PDF sah tanpa data), API (agregasi, 400, hak akses), layar (ekspor mengambil `/history` setahun dari `to`, tidak memotret DOM, nama berkas). Verifikasi di Chrome nyata: ekspor PDF dari data contoh, render halaman dengan PDFKit dan bandingkan berdampingan dengan dua sampel desain.

## 9. Asumsi

- "Semua lokasi" memuat pond aktif yang punya data air atau koagulan dalam jendela setahun; pond tanpa data tidak mendapat halaman kosong.
- Konversi debit: 1 m3/hari = 1000 / 86400 L/s.
- Hari tanpa catatan cuaca ditampilkan `0,0` di tabel (seperti desain) tetapi tidak dianggap hari hujan dan tidak membuat titik grafik 1W (celah), agar tidak menyiratkan pengukuran nol.
