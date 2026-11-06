# Impor data harian dan kondisi no flow

Tanggal: 2026-11-07. Status: menunggu persetujuan.

## Tujuan
Data curah hujan, air, dan koagulan yang selama ini dicatat di Excel bisa dimasukkan ke aplikasi lewat satu berkas templat. Hari tanpa air keluar dari pond (no flow) dicatat dengan benar dan tidak merusak grafik, kepatuhan, maupun laporan.

## Keputusan dari diskusi
- Format impor mengikuti aplikasi, bukan Excel lama. Tidak semua kolom Excel lama diimpor.
- **Debit memakai L/S** di templat dan di seluruh aplikasi (form, riwayat, grafik, laporan). Database tetap menyimpan m³/s; konversi (×1000 / ÷1000) hanya di batas tampilan dan input.
- **Semua koagulan dalam kg**, termasuk Tawas Serbuk. Sak hanya muncul di laporan (1 sak = 25 kg), dan itu sudah ada di PDF dan PPT (`KG_PER_BAG`).
- **Kapur** tetap ada di aplikasi dan di templat.
- **No flow = debit outlet diisi 0.** Tidak ada kolom status baru. pH dan TSS boleh kosong pada hari itu. "No data" diperlakukan sama dengan no flow.
- Stok awal koagulan tidak punya kolom khusus; stok bisa diubah belakangan dan sisa negatif diperbolehkan.
- Impor hanya untuk **Admin**.

## 1. No flow
**Definisi.** Baris air dengan `debit_outlet_m3s = 0` adalah hari no flow. Fungsi bersama di `packages/shared`: `isNoFlow(row)`.

**Form input air.** Tidak ada kontrol baru. Operator mengisi debit outlet 0; pH dan TSS outlet boleh kosong. Hari itu terhitung sudah diisi.

**Grafik.** Hari no flow digambar sebagai 0 untuk pH, TSS, dan debit outlet, dengan penanda khusus agar tidak terbaca sebagai pH 0 sungguhan.

**Kepatuhan.** Hari no flow tidak dihitung sebagai pelanggaran maupun kepatuhan (dikeluarkan dari pembilang dan penyebut).

**Riwayat dan laporan** (layar riwayat, Excel, PDF, PPT). Sel pH/TSS/debit outlet hari no flow menampilkan "No flow", bukan 0 atau kosong. Ringkasan periode menyebut jumlah hari no flow.

## 2. Debit dalam L/S
- Helper di `packages/shared`: `m3sToLs`, `lsToM3s`. Bagian yang kini menampilkan `m³/s` (`InputAir.tsx`, riwayat, grafik dan tabel laporan, ekspor) berganti ke `L/s`. Debit harian (m³/d) tetap dihitung dari m³/s.
- API tidak berubah: tetap menerima dan mengembalikan m³/s. Antrean offline di perangkat operator dan data lama tetap sah.

## 3. Impor Excel
Layar `/input/impor` (Admin), dibuka dari Beranda atau Input. Alur sama dengan impor event: unduh templat, pilih berkas, pratinjau per baris, konfirmasi. Mengimpor berkas yang sama dua kali tidak membuat duplikat.

**Templat (.xlsx)**, lembar `Data` dan lembar `Petunjuk`. Satu baris per tanggal dan pond:

| Kelompok | Kolom |
|---|---|
| Kunci | Tanggal, Pond (kode, mis. SP11) |
| Cuaca | Curah hujan (mm), Jam hujan |
| Air | pH inlet, pH outlet, TSS inlet, TSS outlet, Debit inlet (L/S), Debit outlet (L/S) |
| Koagulan | Tawas Serbuk masuk (kg), Tawas Serbuk keluar (kg), Tawas Batu masuk (kg), Tawas Batu keluar (kg), Kapur masuk (kg), Kapur keluar (kg) |

**Aturan baris**
- Tanggal dan Pond wajib. Pond dicocokkan dengan kode pond aktif. Tanggal dikenali sebagai tanggal Excel asli, `2026-04-01`, atau `01/04/2026`; tidak boleh di masa depan.
- Sel kosong, "no data", dan "no flow" berarti tidak ada nilai. **Sel kosong tidak menimpa** nilai yang sudah ada di aplikasi.
- Debit L/S dikonversi ke m³/s saat disimpan. Rentang nilai sama dengan form biasa (pH 0 sampai 14, nilai lain tidak negatif).
- Cuaca per tanggal, bukan per pond. Beberapa baris pada tanggal yang sama dengan curah hujan atau jam hujan berbeda: barisnya ditandai error.
- Stok sisa koagulan tidak diimpor; sistem menghitungnya berurutan dari stok sebelumnya, boleh negatif.
- Batas 1.000 baris per berkas. Baris kosong dilewati.

**Status baris di pratinjau:** baru, diperbarui, tidak berubah, dilewati, error, dengan alasan per baris. Tombol "Impor" menyimpan baris yang sah saja.

**Pembaca Excel.** Pembaca xlsx yang sudah ada (`lib/xlsxRead.ts`) dipakai ulang. Tidak ada dependensi baru. Hanya `.xlsx`.

## 4. API
`POST /entries/import` (Admin), menerima `{ rows, dry }`, maksimal 1.000 baris. `dry: true` mengembalikan hasil per baris tanpa menyimpan. Penulisan memakai aturan yang sama dengan `PUT` air, cuaca, dan koagulan (rentang nilai, pond aktif), dalam batch.

## 5. Pengujian
- shared: `isNoFlow`, konversi L/S, validasi dan pencocokan baris impor (tanggal, kode pond, "no data", konflik cuaca).
- API: impor `dry` dan nyata (baru, perbarui, tidak berubah, error), izin hanya Admin, batas 1.000, sel kosong tidak menimpa, impor ulang tidak menduplikasi.
- web: grafik dan kepatuhan mengecualikan hari no flow, label "No flow" di riwayat dan laporan, tampilan L/s, layar impor.

## Di luar cakupan
Kolom status air di database, impor `.csv`, pengisian stok awal lewat templat, impor CSV/Excel di luar format templat, perubahan satuan penyimpanan di database.

## Asumsi yang perlu dikonfirmasi
1. Pond dalam templat diidentifikasi dengan **kode** (mis. SP11). Jika kode belum terisi untuk suatu pond, baris itu error.
2. Hari dengan debit outlet 0 tetapi pH atau TSS diisi tetap dianggap no flow (nilai pH dan TSS disimpan, hanya tidak dihitung kepatuhan).
3. Impor boleh menulis tanggal lampau tanpa batas bawah selain 1 Jan 2000.
