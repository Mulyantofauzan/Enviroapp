# Delivery Gate: EVO UI redesign (Bagian 1)

Mode antislop: selama bekerja. Arah desain: `design/` (Figma pemilik produk). Dial: ENERGY 2 / RHYTHM 2 / MOTION 1 (Design Read: aplikasi operasional lapangan untuk operator dan manajer, bahasa visual hijau-biru Figma).

Bukti diambil pada 2026-11-02: `npm test` (shared 40, api 92, web 110, semua lulus), `tsc` bersih, `vite build` berhasil, `wrangler dev` dengan D1 lokal (migrasi 0002), Chrome headless via CDP pada 360px dan 1200px untuk 11 halaman.

## Blok 1: Hard Gate

| Aturan | Hasil | Bukti |
|---|---|---|
| R-02 em dash | PASS | `grep` karakter em dash di `apps/*/src` dan `packages/shared/src` (selain tes): kosong |
| R-03 mobile | PASS | 10 halaman pada 360px: `scrollWidth` 360, tanpa overflow horizontal (sebelumnya 447/427/398 pada Input Air, Koagulan, Riwayat; diperbaiki dengan `minmax(0,1fr)`). Target sentuh: tidak ada kontrol interaktif < 40px kecuali saklar 52x30, yang diberi area sentuh 44px lewat `::after` |
| R-17 statistik | PASS | Semua angka berasal dari database. Tanpa data: "Belum diisi" atau "Belum ada data ..." |
| R-18 testimoni | PASS | Tidak ada |
| R-23 aset | PASS | Logo berupa teks "EVO"; avatar inisial. Data contoh di Figma (nama, nilai) tidak dibawa ke aplikasi |
| R-24 navigasi | PASS | Semua tujuan di `nav.ts` punya rute di `App.tsx`. Kalender, Laporan, Eviden tidak ditampilkan karena belum ada |
| R-25 kontras | **FAIL (keputusan pemilik produk)** | Pemilik memilih warna persis Figma. Rasio teks kecil: warning `#D97706` di `#FFF1D6` 2,85; success `#12A150` di `#DDF5E6` 2,93; danger `#D92D20` di `#FEE4E2` 4,01; water `#1C7ED6` di `#E4F0FB` 3,63; batas input `#DAE3E0` di putih 1,31 (komponen perlu 3:1). Terdampak: chip Normal, Sudah diisi, Aktif, badge Manager dan Operator, nilai abnormal, batas kolom. Mitigasi: chip selalu berisi kata, tidak hanya warna. Lolos: teks utama 16,8; primary di putih 5,13; putih di primary 5,13; text-sub 4,98 sampai 5,37; danger di putih 4,83; Auditor `#5B3FA8` di `#EDE9FB` 6,49 |
| R-26 kontrol berfungsi | PASS | Tidak ada tombol tanpa penangan (grep). Tiap tombol simpan, toggle, tab, filter diuji dengan `userEvent` di tes layar |
| R-27 keadaan | PASS | Beranda, Input, Dashboard, Riwayat punya memuat, kosong, galat dengan sebab dan langkah. Master dan Pengguna: memuat, kosong, galat lewat toast |
| R-28 FAQ | N/A | Tidak ada |
| R-32 keyboard | SEBAGIAN | Semua kontrol adalah elemen HTML asli (`button`, `a`, `select`, `input`, `role=switch/tab`); cincin fokus 3px terlihat. Kolom angka memakai cincin pada pembungkus (`:has(:focus-visible)`). Belum ada uji Tab satu per satu di peramban sungguhan |
| R-33 patch script | PASS | Tidak ada |
| R-34 tema | N/A | Satu tema terang, tanpa tombol tema |
| R-35 verifikasi | SEBAGIAN | Dijalankan: build, tes, `wrangler dev`, Chrome headless 360 dan 1200px (screenshot dibaca langsung). Klik-lewat tiap kontrol dilakukan lewat tes jsdom, bukan di peramban sungguhan. HP sungguhan belum dicoba |
| R-36 klaim | PASS | Tidak ada klaim kepatuhan atau performa |
| R-37 arah desain | PASS | `design/` (Foundations, Components, 13 layar) |
| R-38 konten nyata | PASS | Lihat R-17 dan R-23 |

## Blok 2: Purpose-Gate

Gradien, glow, blur kaca, bayangan: tidak dipakai. Radius: kartu 20, kolom 14, tombol 14, pil hanya untuk badge, chip, dan saklar (sesuai Figma). Ikon: set garis buatan sendiri mengikuti bentuk Figma, tiap ikon relevan dengan isinya (tetes untuk air, labu untuk koagulan, awan hujan untuk cuaca) dan diberi label teks. Huruf: Inter dari Foundations Figma. Panah dekoratif dan emoji: tidak ada (grep). Gerak: satu denyut sekali saat nilai melewati baku mutu, mati bila `prefers-reduced-motion`. Ilustrasi: tidak ada.

## Blok 3: Liveliness

Dial dinyatakan di atas. Satu titik fokus per layar: kartu pH Outlet (Beranda dan Dashboard), kolom yang sedang diisi (Input). Satu aksen sinyal: danger, hanya untuk nilai abnormal. Motif identitas: gelembung ikon berwarna per modul (air hijau, cuaca biru, koagulan oranye) dan tab berpil.

## Blok 4: Craftsmanship

C-1 sampai C-5: tiap keputusan visual berasal dari Figma atau dicatat sebagai keputusan di spec; tidak ada seksi pengisi template; tidak ada klaim fiktif; keadaan kosong, memuat, galat ada.

## Belum dikerjakan atau belum terverifikasi

Kalender, Bukti (kamera, GPS, R2), Laporan (Excel, PDF), mode luring: bagian 2 sampai 5. Uji di HP sungguhan (kamera tidak relevan di bagian ini), uji keyboard manual, dan keputusan warna R-25 menunggu pemilik produk.
