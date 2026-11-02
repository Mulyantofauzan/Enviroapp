# EVO — Environment Operations

Phone-first PWA for logging weather, settling-pond water quality and coagulant stock.
Stack: Cloudflare Workers + Hono + D1 (API), React + Vite PWA (web). Spec: `docs/superpowers/specs/`.

## Setup
```
npm install
npx wrangler d1 create evo            # copy database_id into apps/api/wrangler.jsonc
cd apps/api
npx wrangler d1 migrations apply evo --local     # use --remote for production
npx tsx scripts/seed-admin.ts you@example.com 'a-long-password'   # add --remote for production
```

## Develop
```
npm run build -w @evo/web             # API serves apps/web/dist
cd apps/api && npx wrangler dev       # http://localhost:8787
npm run dev -w @evo/web               # optional: Vite on :5173, proxies /api to :8787
```
Migrations: `npx wrangler d1 migrations apply evo --local` (0001 schema, 0002 redesign: pond code/coordinates, per-pond limits, user active flag).

## Peran dan layar
| Peran | Tab | Catatan |
|---|---|---|
| Operator | Beranda, Input, Kalender, Akun | Isi cuaca, air, koagulan; Riwayat lewat Akun |
| Manager | Beranda (Dashboard), Kalender, Akun | Grafik pH, TSS, curah hujan, stok koagulan, ringkasan kalender; baca saja |
| Auditor | Kalender, Riwayat, Akun | Baca saja |
| Admin | Beranda (Dashboard), Input, Kalender, Akun | Akses penuh; dashboard sama dengan Manager; Pengguna, Master, Atur jadwal lewat Akun |

Setelah masuk sebagai Admin: tambah settling pond di Master (isi kode, koordinat, baku mutu pH dan TSS), lalu tambah pengguna di Kelola Pengguna. Desain acuan ada di `design/`.

## Test
```
npm test
```

## Deploy
```
npm run build -w @evo/web
cd apps/api && npx wrangler d1 migrations apply evo --remote && npx wrangler deploy
```
The one Worker serves the API under `/api` and the built PWA for every other path.

## Kalender dan eviden
Tab Kalender menampilkan jadwal berulang (harian sampai tahunan). Tanggal yang terlewat tanpa eviden tetap merah satu per tanggal. Manager dan Admin mengatur jadwal; Operator dan Admin mengunggah eviden (foto atau PDF, maksimal 10 MB) dan menyelesaikan event. Waktu situs: WITA.

File eviden disimpan di R2 (binding `EVIDENCE`). Saat pengembangan, `wrangler dev` mensimulasikannya sendiri. Untuk deploy: `npx wrangler r2 bucket create evo-evidence`, lalu `npx wrangler d1 migrations apply evo --remote` (migrasi 0003 dan 0004).

## Kamera eviden dan layar Eviden
"Ambil foto" di Eksekusi event membuka kamera langsung; koordinat GPS dan waktu WITA ditempel ke dalam gambar, lalu disimpan dengan akurasi dan waktu ambil. Tanpa lokasi foto tetap tersimpan dengan tanda "Tanpa lokasi". Foto dari galeri tidak membawa lokasi. Layar Eviden (`/eviden`, semua peran, baca saja untuk Auditor) memuat daftar lintas event dengan filter jadwal dan rentang 7/30/90 hari, pratinjau, unduh satu per satu, dan "Unduh semua eviden (ZIP)" (maksimal 100 berkas).

**Kamera dan GPS peramban butuh HTTPS** (localhost dikecualikan). Di HP, kamera baru jalan setelah deploy ke alamat https; lewat `http://192.168.x.x` peramban menolak dan aplikasi menampilkan "Kamera butuh koneksi aman (HTTPS)" dengan jalur galeri tetap ada.

## Laporan
`/laporan` (Manager, Admin, Auditor): pilih Lokasi, Periode (7 hari awal, atau 30 hari, bulan ini, bulan lalu, atur sendiri sampai 366 hari) dan data (Cuaca, Air Permukaan, Koagulan, Event). Pratinjau tabel memakai baku mutu pond (sel merah). Sembilan grafik berlabel data: curah hujan (7 hari, rata-rata 5 minggu, rata-rata 12 bulan), pH, TSS, dan debit outlet (mengikuti periode, butuh satu lokasi), penggunaan koagulan per jenis, dan penggunaan tawas (Serbuk + Batu, kg) per minggu dan per bulan. "Ekspor Excel (.xlsx)" menghasilkan tabel (lembar Ringkasan plus satu lembar per data, tanpa grafik); "Ekspor PDF" (A4 lanskap) bergaya slide mengikuti `Design/Laporan Cuaca.pdf` dan `Design/Laporan pond.pdf`: satu halaman "WEATHER MONITORING", satu halaman per pond berjudul `{KODE NAMA} MONITORING` (mis. "SP 11 LGG MONITORING"), dan tabel Event bila dipilih. Grafik digambar dari data (bukan dari layar) untuk jendela yang berakhir di tanggal akhir Periode (7 hari, 5 minggu ISO, 12 bulan); grafik 1 bulan dan 1 tahun memakai total, bukan rata-rata. Tanpa kolom Shift, logo, batang oranye, footer, dan nomor halaman oranye. Ekspor PDF mengambil `/history` setahun ke belakang dan `GET /api/history/coagulant-total?to=&sp=` (total Serbuk, Batu, dan Kapur seumur data untuk kotak Project To Date). Keduanya dibuat di peramban; pustaka PDF dimuat hanya saat tombol ditekan. Batas 20.000 baris per ekspor.

## Security note
The login route has no built-in attempt limit. Before field use, add a Cloudflare rate-limiting rule for `POST /api/auth/login` in the dashboard.

## Not in this version
Offline data queue. Offline now means the app shell opens without signal; saving needs a connection.
