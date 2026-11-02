# EVO Bagian 3: Bukti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kamera langsung dengan cap lokasi dan waktu di dalam foto, kolom lokasi pada eviden, pratinjau besar, layar Eviden dengan filter dan unduh ZIP.

**Architecture:** API menerima metadata kamera pada unggahan yang sudah ada dan menambah satu endpoint daftar. Web menambah modul kamera (kanvas untuk cap, `getUserMedia`, `watchPosition`), dialog kamera, pratinjau, layar Eviden, dan pembuat ZIP di peramban dengan `fflate`.

**Tech Stack:** TypeScript, Hono, D1, R2, React 18, Vitest, `fflate`.

**Spec:** `docs/superpowers/specs/2026-11-02-evo-evidence-design.md` (juga `2026-11-02-evo-calendar-design.md`; gambar `design/07`, `design/08`, `design/Eviden Auditor (Read-only).png`)

## Global Constraints

- Cap: `GPS {lat}, {lng} - {2 Nov 2026 08:21} WITA`; tanpa lokasi: `Tanpa lokasi - {2 Nov 2026 08:21} WITA`. Lintang dan bujur lima desimal bertitik. Waktu WITA (`Asia/Makassar`).
- Foto kamera: sisi terpanjang maksimal 1600 px, JPEG kualitas 0,85, cap di bilah bawah di dalam gambar. Foto galeri tidak diberi cap dan tidak membawa lokasi.
- `source` hanya `camera` atau `gallery`. Kamera wajib `taken_at` (≤ 5 menit di masa depan, ≤ 14 hari ke belakang). Koordinat berpasangan, lintang -90..90, bujur -180..180, akurasi 0..100000.
- ZIP maksimal 100 berkas; lebih dari itu tidak mengunduh apa pun dan meminta rentang dipersempit. Satu berkas gagal membatalkan seluruh ZIP.
- Kamera dan GPS butuh konteks aman: bila tidak, tampilkan pesan Indonesia dan biarkan tombol galeri bekerja. Semua trek video dihentikan di setiap jalur keluar.
- Hak: Operator dan Admin memotret dan mengunggah pada event terbuka; semua peran yang masuk melihat Eviden dan mengunduh. Auditor melihat "Hanya baca".
- Target sentuh ≥ 44 px, tanpa overflow di 360 px, fokus keyboard terlihat, `prefers-reduced-motion` dihormati. Teks UI Indonesia. Tanpa emoji dan tanpa animasi masuk.
- Warna Figma apa adanya (keputusan pemilik produk sebelumnya).

## Review Focus

- Koordinat dan waktu palsu pada unggahan: lintang 91, NaN, hanya salah satu dari lintang atau bujur, akurasi sangat besar, `taken_at` masa depan, terlalu lama, atau bukan tanggal, `source` asing, dan foto galeri yang membawa koordinat: ditolak atau diabaikan dengan benar.
- Siklus hidup kamera: trek dihentikan saat ditutup, saat komponen dilepas, saat izin ditolak, saat galat, setelah memotret; menekan rana dua kali cepat tidak mengunggah dua kali; menutup dialog saat foto sedang diunggah.
- Cap yang benar: tanda lintang dan bujur negatif, batas hari WITA (16:30 UTC sudah hari berikutnya), tanpa lokasi, dan teks tidak terpotong pada gambar sempit.
- ZIP: 101 berkas ditolak tanpa mengunduh, nama berkas kembar, karakter berbahaya pada nama dan judul, satu berkas gagal, dan memori untuk 100 foto.
- Daftar eviden: batas halaman dan `offset` melewati total, rentang > 366 hari, filter jadwal dan pond, dan semua peran bisa membaca.
- Auditor tidak punya tombol ambil foto, unggah, atau hapus di Eksekusi event maupun di layar Eviden.

---

### Task 1: API: migrasi 0004 dan metadata kamera pada unggahan

**Files:**
- Create: `apps/api/migrations/0004_evidence_meta.sql`, `apps/api/src/events/evidence-meta.ts`
- Modify: `apps/api/src/events/evidence.ts`, `apps/api/src/events/events.ts` (detail memuat kolom baru)
- Test: `apps/api/test/evidence-meta.test.ts`

**Interfaces:**
- Produces:
  - `readCameraMeta(form: FormData, now: Date): { source: 'camera'|'gallery'; gps_lat: number|null; gps_lng: number|null; gps_accuracy: number|null; taken_at: string|null } | { error: string }`
  - Unggahan menyimpan kolom baru. Respons unggah: `{ id, filename, mime, size, source, gps_lat, gps_lng, gps_accuracy, taken_at }`. Detail event: tiap eviden memuat `source, gps_lat, gps_lng, gps_accuracy, taken_at`.

- [ ] **Step 1: Tes gagal**: galeri tanpa kolom tambahan -> `source:'gallery'` dan semua lokasi null; galeri yang mengirim `gps_lat`, `gps_lng`, `taken_at` -> kolom itu diabaikan (null); kamera lengkap (`gps_lat=-3.78421`, `gps_lng=115.60214`, `gps_accuracy=12.5`, `taken_at` sekarang) tersimpan persis dan muncul di respons dan di detail event; kamera tanpa koordinat tetapi `taken_at` sah -> 201 dengan koordinat null; kamera tanpa `taken_at` -> 400 "Waktu foto kamera wajib ada."; `taken_at` 10 menit ke depan -> 400; 15 hari ke belakang -> 400; `taken_at` "bukan tanggal" -> 400; `source=drone` -> 400 "Sumber foto tidak dikenal."; lintang 91 -> 400 "Lintang harus antara -90 dan 90."; bujur 181 -> 400; "abc" sebagai lintang -> 400; hanya `gps_lat` tanpa `gps_lng` -> 400 "Lintang dan bujur harus dikirim berpasangan."; akurasi -1 dan 100001 -> 400; batas tepat -90, 90, -180, 180, akurasi 0 diterima; migrasi 0004 pada tabel yang sudah berisi baris menjadikan baris lama `source:'gallery'`.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api`. Expected: FAIL.
- [ ] **Step 3:** Tulis migrasi, `readCameraMeta`, dan sambungkan ke INSERT; perluas `SELECT` detail. Pesan galat diperiksa sebelum berkas ditulis ke R2.
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): metadata kamera pada eviden`.

### Task 2: API: daftar eviden lintas event

**Files:**
- Modify: `apps/api/src/events/evidence.ts`
- Test: `apps/api/test/evidence-list.test.ts`

**Interfaces:**
- Consumes: `isValidDate`, `requireAuth`.
- Produces: `GET /evidence?from=&to=&schedule=&sp=&offset=&limit=` sesuai spec bagian 4; satu `COUNT` dan satu `SELECT` per permintaan.

- [ ] **Step 1: Tes gagal**: tanpa `from` atau `to` -> 400; rentang 367 hari -> 400; 366 hari diterima; tanggal salah -> 400; hasil urut `due_date` menurun lalu `uploaded_at` menurun; memuat `title`, `due_date`, `uploaded_by_name`, `uploaded_by_role`, `sp_id`, dan metadata kamera; filter `schedule` hanya satu jadwal; filter `sp` menyertakan jadwal pond itu dan jadwal tanpa pond; `limit` default 50, `limit=1000` dibatasi 100, `limit=0` atau negatif -> 400; `offset` melewati total -> `items` kosong dan `total` tetap benar; `total` tidak terpengaruh `limit` dan `offset`; semua peran (Auditor, Manager, Operator, Admin) bisa membaca; tanpa sesi 401; eviden jadwal yang dihentikan tetap muncul; jumlah query D1 ≤ 4 termasuk sesi (pembungkus `prepare` seperti tes lain); `GET /evidence/:id/file` lama tetap bekerja.
- [ ] **Step 2:** Jalankan `npm test -w @evo/api`. Expected: FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npm test -w @evo/api`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): daftar eviden`.

### Task 3: Web: cap, bingkai kamera, lokasi

**Files:**
- Create: `apps/web/src/lib/stamp.ts`, `apps/web/src/lib/capture.ts`, `apps/web/src/hooks/useGeolocation.ts`
- Test: `apps/web/src/lib/stamp.test.ts`, `apps/web/src/lib/capture.test.ts`, `apps/web/src/hooks/useGeolocation.test.ts`

**Interfaces:**
- Produces:
  - `formatCoords(lat: number, lng: number): string` -> `-3.78421, 115.60214`
  - `stampText(pos: {lat:number; lng:number} | null, at: Date): string`
  - `captureStamped(video: HTMLVideoElement, text: string, maxSide?: number): Promise<Blob>` (kanvas, JPEG 0,85)
  - `type GeoState = { status: 'locating'|'ready'|'denied'|'unavailable'; position: {lat:number; lng:number; accuracy:number} | null }`; `useGeolocation(active: boolean): GeoState`

- [ ] **Step 1: Tes gagal**: `formatCoords(-3.784212, 115.602139)==='-3.78421, 115.60214'`; `formatCoords(0, -0.5)==='0.00000, -0.50000'`; `stampText({lat:-3.78421,lng:115.60214}, new Date('2026-11-02T00:21:00Z'))==='GPS -3.78421, 115.60214 - 2 Nov 2026 08:21 WITA'`; `stampText(null, new Date('2026-11-02T16:30:00Z'))==='Tanpa lokasi - 3 Nov 2026 00:30 WITA'`; `captureStamped` dengan kanvas tiruan: video 3200x2400 menghasilkan kanvas 1600x1200, memanggil `fillText` dengan teks cap, `toBlob` dipanggil dengan `image/jpeg` dan `0.85`; video 800x600 tidak diperbesar; `toBlob` mengembalikan null -> ditolak dengan galat "Gagal membuat foto."; ukuran font cap sebanding dengan lebar gambar (lebar 1600 lebih besar dari lebar 400) dan teks panjang dikecilkan sampai muat (`measureText` tiruan); `useGeolocation(false)` tidak memanggil `watchPosition`; `useGeolocation(true)` memulai dengan `locating`, menjadi `ready` dengan posisi saat callback sukses, `denied` untuk kode galat 1, `unavailable` untuk kode lain dan saat `navigator.geolocation` tidak ada, dan memanggil `clearWatch` saat `active` menjadi false dan saat dilepas.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi. Waktu WITA lewat `Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar' })`; bulan tanpa titik.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): cap foto, kanvas, lokasi`.

### Task 4: Web: dialog kamera

**Files:**
- Create: `apps/web/src/components/CameraCapture.tsx`
- Modify: `apps/web/src/icons/index.tsx` (ikon `camera`, `image`, `refresh`, `download`), `apps/web/src/styles/ui.css`
- Test: `apps/web/src/components/CameraCapture.test.tsx`

**Interfaces:**
- Consumes: `useGeolocation`, `stampText`, `captureStamped`, `formatDateId`.
- Produces: `CameraCapture({ title, onClose, onUse, onGallery }: { title: string; onClose: () => void; onUse: (photo: { blob: Blob; lat: number|null; lng: number|null; accuracy: number|null; takenAt: string }) => void | Promise<void>; onGallery: (file: File) => void })`

- [ ] **Step 1: Tes gagal** dengan `navigator.mediaDevices.getUserMedia` dan `navigator.geolocation` tiruan, `isSecureContext` diatur per tes: merender `role=dialog` bernama "Kamera eviden" dengan judul event; fokus awal pada tombol "Tutup kamera"; Escape memanggil `onClose`; saat ada stream menampilkan `video`, bilah info dengan koordinat dan "WITA", dan teks "Geotag dan timestamp otomatis ditempel pada foto"; tanpa posisi menampilkan "Mencari lokasi…" lalu "Lokasi tidak tersedia" bila ditolak; menekan "Ambil foto" memanggil `captureStamped` dan menampilkan pratinjau dengan "Ulangi" dan "Gunakan foto"; "Ulangi" kembali ke video tanpa membuka stream baru dan membuang pratinjau; "Gunakan foto" memanggil `onUse` sekali dengan koordinat dan akurasi terakhir dan `takenAt` ISO, dan tombol nonaktif sampai selesai (tekan dua kali tetap satu panggilan); tanpa posisi `onUse` menerima `lat:null,lng:null`; semua `track.stop()` dipanggil saat ditutup, saat dilepas, setelah memotret, dan saat `getUserMedia` ditolak setelah sebagian stream ada; konteks tidak aman menampilkan "Kamera butuh koneksi aman (HTTPS)." tanpa memanggil `getUserMedia`; `NotAllowedError` menampilkan "Izin kamera ditolak. Aktifkan di pengaturan peramban."; `NotFoundError` menampilkan "Kamera tidak ditemukan."; galat lain menampilkan "Kamera tidak bisa dibuka. Coba lagi."; pada setiap galat tombol galeri tetap ada dan memanggil `onGallery` dengan berkas yang dipilih; tombol balik kamera meminta stream dengan `facingMode` berlawanan dan menghentikan trek lama; semua tombol berlabel dan ≥ 44 px (kelas).
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi. Komponen membersihkan `useEffect` dengan penanda `cancelled` agar stream yang tiba setelah dilepas tetap dihentikan.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): dialog kamera eviden`.

### Task 5: Web: Eksekusi event memakai kamera, pratinjau besar

**Files:**
- Create: `apps/web/src/components/EvidenceViewer.tsx`, `apps/web/src/components/EvidenceMeta.tsx`
- Modify: `apps/web/src/screens/EventDetail.tsx`
- Test: `apps/web/src/screens/EventDetail.test.tsx` (diperbarui), `apps/web/src/components/EvidenceViewer.test.tsx`

**Interfaces:**
- Consumes: `CameraCapture`, `formatCoords`, `api()` dengan `FormData`.
- Produces:
  - `EvidenceMeta({ e }: { e: { source: 'camera'|'gallery'; gps_lat: number|null; gps_lng: number|null; taken_at: string|null } })`: baris `GPS lat, lng` bila ada, lencana "Tanpa lokasi" untuk kamera tanpa koordinat, lencana "Galeri" untuk galeri.
  - `EvidenceViewer({ item, onClose })`: dialog dengan gambar penuh (`alt` nama berkas), judul, tanggal, pengunggah, `EvidenceMeta`, waktu unggah, tautan "Unduh", tombol "Tutup"; Escape menutup.
  - Unggahan kamera mengirim `source=camera`, `gps_lat`, `gps_lng`, `gps_accuracy`, `taken_at` bersama `file`; galeri mengirim `source=gallery`.

- [ ] **Step 1: Tes gagal**: tombol "Ambil foto" dan "Unggah galeri" tampil untuk Operator dan Admin pada event terbuka dan tidak untuk Manager, Auditor, event selesai, atau event mendatang; "Ambil foto" membuka dialog kamera; `onUse` mengirim `POST` multipart dengan `source=camera` dan nilai koordinat dan `taken_at` dari foto, lalu menutup dialog, menampilkan toast "Eviden diunggah" dan memuat ulang daftar; foto tanpa lokasi mengirim `source=camera` tanpa kolom koordinat; kamera tanpa HTTPS (tiruan) tetap membuka dialog dengan pesan HTTPS dan galeri di dalamnya mengunggah dengan `source=gallery`; galat API saat mengunggah dari kamera menampilkan pesan dan dialog tetap terbuka agar foto bisa dicoba lagi; baris eviden menampilkan koordinat, lencana "Tanpa lokasi", atau "Galeri" sesuai data; mengetuk gambar membuka `EvidenceViewer` yang memuat koordinat dan waktu, Escape menutup, fokus kembali ke gambar yang diketuk; PDF tidak membuka penampil melainkan tautan unduh; hapus tetap hanya untuk pengunggah atau Admin pada event terbuka.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): kamera dan pratinjau di Eksekusi event`.

### Task 6: Web: layar Eviden dan navigasi

**Files:**
- Create: `apps/web/src/screens/Eviden.tsx`, `apps/web/src/hooks/useEvidenceList.ts`
- Modify: `apps/web/src/nav/nav.ts`, `apps/web/src/App.tsx`
- Test: `apps/web/src/screens/Eviden.test.tsx`, `apps/web/src/nav/nav.test.tsx` (diperbarui)

**Interfaces:**
- Consumes: `GET /evidence`, `GET /schedules?all=1`, `EvidenceViewer`, `EvidenceMeta`, `formatDateId`.
- Produces: rute `/eviden` untuk semua peran; `navFor('Auditor').tabs` berlabel `['Kalender','Riwayat','Eviden','Akun']`; peran lain mendapat "Eviden lapangan" di `more`.

- [ ] **Step 1: Tes gagal**: kepala "Eviden Lapangan"; lencana "Hanya baca" untuk Auditor dan tidak untuk Operator; chip "Semua" dan satu per judul jadwal; memilih chip meminta `schedule=` jadwal itu; rentang awal 30 hari (`from` dan `to` sesuai hari ini dari server atau perangkat) dan memilih "7 hari" atau "90 hari" mengubah `from`; kartu menampilkan gambar lewat `/api/evidence/{id}/file`, judul event, tanggal dan jam WITA, "{nama} - {peran}", koordinat atau lencana; "Pratinjau" membuka penampil, "Unduh" adalah tautan `download` ke berkas; PDF tampil dengan ikon dokumen tanpa gambar; `total` melebihi yang tampil menampilkan "Muat lebih banyak" yang meminta `offset` berikutnya dan menambah kartu tanpa menghapus yang lama; kosong "Belum ada eviden pada rentang ini."; galat sebagai `role=alert`; Auditor, Manager, dan Operator semuanya tidak melihat tombol hapus, ambil foto, atau unggah di layar ini; nav: label tab per peran, `more` memuat "Eviden lapangan" untuk Operator, Manager, Admin dan tidak untuk Auditor; rute `/eviden` terbuka untuk semua peran.
- [ ] **Step 2:** Jalankan `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi.
- [ ] **Step 4:** Jalankan `npm test -w @evo/web` dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): layar Eviden dan navigasi`.

### Task 7: Web: unduh semua dalam ZIP

**Files:**
- Create: `apps/web/src/lib/zip.ts`
- Modify: `apps/web/package.json` (`fflate`), `apps/web/src/screens/Eviden.tsx`
- Test: `apps/web/src/lib/zip.test.ts`, `apps/web/src/screens/Eviden.test.tsx` (tambahan)

**Interfaces:**
- Produces:
  - `safeEntryName(item: { due_date: string; title: string; filename: string }, n: number): string` -> `{due_date}_{judul}_{n}_{nama}` dengan karakter di luar huruf, angka, titik, minus, garis bawah diganti `_` dan dibatasi 120 karakter
  - `buildZip(items: ZipItem[], fetchFile: (id: string) => Promise<Uint8Array>, onProgress: (done: number, total: number) => void): Promise<Blob>`; menolak dengan `Error` yang menyebut nama berkas bila satu gagal

- [ ] **Step 1: Tes gagal**: `safeEntryName` mengganti `/`, `\`, `..`, tanda kutip, spasi ganda, dan karakter non-ASCII, memotong sampai 120 karakter, dan selalu menyertakan nomor sehingga dua berkas bernama sama menghasilkan nama berbeda; `buildZip` pada tiga item menghasilkan ZIP yang bila dibuka (`unzipSync`) memuat tiga entri dengan isi persis dan nama unik; `onProgress` dipanggil `(1,3)`, `(2,3)`, `(3,3)`; satu `fetchFile` menolak -> `buildZip` menolak dengan pesan memuat nama berkas itu dan tidak mengembalikan Blob; daftar kosong menolak; layar: tombol "Unduh semua eviden (ZIP)" meminta `limit=100`; `total` 101 menampilkan "Ada 101 eviden. Persempit rentang agar tidak lebih dari 100." dan tidak mengambil berkas apa pun; saat berjalan menampilkan "Menyiapkan 2 dari 3" dan menonaktifkan tombol; sukses memicu unduhan `eviden-{from}-{to}.zip`; kegagalan satu berkas menampilkan pesan dan tidak memicu unduhan; tombol nonaktif tanpa eviden.
- [ ] **Step 2:** Jalankan `npm install` lalu `npm test -w @evo/web`. Expected: FAIL.
- [ ] **Step 3:** Implementasi dengan `zipSync(files, { level: 0 })`; berkas diambil berurutan.
- [ ] **Step 4:** Jalankan `npm test` dari akar dan `npx tsc --noEmit -p apps/web`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): unduh semua eviden dalam ZIP`.

### Task 8: Verifikasi, dokumen, laporan Delivery Gate

**Files:**
- Modify: `README.md`, `anti-slop/delivery-gate-2026-11-02.md`

- [ ] **Step 1:** Jalankan `npm test`, `npx tsc --noEmit -p apps/web`, `npm run build -w @evo/web`. Expected: lulus.
- [ ] **Step 2:** Terapkan migrasi 0004 lokal; lewat `curl` unggah foto berkoordinat sebagai Operator, baca kembali sebagai Auditor lewat `/api/evidence`, dan cek penolakan koordinat dan waktu palsu.
- [ ] **Step 3:** Di Chrome nyata dengan kamera buatan dan lokasi buatan (CDP `Emulation.setGeolocationOverride`): buka Eksekusi event, ambil foto, gunakan, baca kembali dari server dan periksa gambar bercap dan koordinatnya; uji juga izin lokasi ditolak (foto "Tanpa lokasi") dan kamera pada konteks tidak aman; ambil dua foto, buka layar Eviden sebagai Auditor, uji filter, pratinjau, unduh ZIP dan periksa isinya.
- [ ] **Step 4:** Ukur overflow dan target sentuh pada 360 dan 1200 px untuk dialog kamera, penampil, dan layar Eviden; baca tangkapan layarnya.
- [ ] **Step 5:** Perbarui README dan laporan Delivery Gate; commit `docs: verifikasi bagian Bukti`.
