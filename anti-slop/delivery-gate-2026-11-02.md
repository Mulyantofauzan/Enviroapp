# Delivery Gate: ENVIRO UI redesign (Bagian 1)

Mode antislop: selama bekerja. Arah desain: `design/` (Figma pemilik produk). Dial: ENERGY 2 / RHYTHM 2 / MOTION 1 (Design Read: aplikasi operasional lapangan untuk operator dan manajer, bahasa visual hijau-biru Figma).

Bukti diambil pada 2026-11-02: `npm test` (shared 40, api 92, web 110, semua lulus), `tsc` bersih, `vite build` berhasil, `wrangler dev` dengan D1 lokal (migrasi 0002), Chrome headless via CDP pada 360px dan 1200px untuk 11 halaman.

## Blok 1: Hard Gate

| Aturan | Hasil | Bukti |
|---|---|---|
| R-02 em dash | PASS | `grep` karakter em dash di `apps/*/src` dan `packages/shared/src` (selain tes): kosong |
| R-03 mobile | PASS | 10 halaman pada 360px: `scrollWidth` 360, tanpa overflow horizontal (sebelumnya 447/427/398 pada Input Air, Koagulan, Riwayat; diperbaiki dengan `minmax(0,1fr)`). Target sentuh: tidak ada kontrol interaktif < 40px kecuali saklar 52x30, yang diberi area sentuh 44px lewat `::after` |
| R-17 statistik | PASS | Semua angka berasal dari database. Tanpa data: "Belum diisi" atau "Belum ada data ..." |
| R-18 testimoni | PASS | Tidak ada |
| R-23 aset | PASS | Logo berupa teks "ENVIRO"; avatar inisial. Data contoh di Figma (nama, nilai) tidak dibawa ke aplikasi |
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

---

# Tambahan: Bagian 2 (Kalender, Eviden, Atur jadwal, Riwayat tabel)

Bukti: `npm test` (shared 58, api 179, web 176, semua lulus), `tsc` bersih, `vite build` berhasil, `wrangler dev` dengan D1 dan R2 lokal (migrasi 0003), Chrome headless 360px dan 1200px untuk 12 layar, dan unggah PNG sungguhan lewat `curl` multipart ke R2 lokal.

| Aturan | Hasil | Bukti |
|---|---|---|
| R-02 em dash | PASS | `grep` pada `apps/*/src` dan `packages/shared/src` selain tes: kosong |
| R-03 mobile | PASS dengan catatan | 12 layar pada 360px: `scrollWidth` 360, tanpa overflow horizontal. Tabel Riwayat menggulir ke samping di dalam wadahnya sendiri, kolom Tanggal menempel. Tombol hari di strip dan tombol aksi tabel 44px. Judul kartu event berupa tautan teks setinggi 20px; seluruh kartu dijadikan area tekan lewat elemen semu `::after`, yang tidak terukur oleh skrip pengukur, jadi tinggi area tekan sebenarnya belum terukur |
| R-17, R-18, R-36, R-38 | PASS | Tidak ada angka, nama, atau eviden karangan. Eviden hanya yang diunggah. Data contoh di Figma tidak dibawa |
| R-24 navigasi | PASS | Tab Kalender menuju `/kalender`; "Atur jadwal" menuju `/kalender/jadwal` (hanya Manager dan Admin); semua rute ada di `App.tsx`. Laporan dan Eviden belum ada dan tidak ditampilkan |
| R-25 kontras | **FAIL (keputusan pemilik produk)** | Pasangan baru yang gagal untuk teks kecil: badge "Hari ini" dan tanggal (water `#1C7ED6` di `#E4F0FB`, 3,63); "Selesai terlambat" (warning di warning-soft, 2,85); teks keterangan kartu overdue dan sel tabel di luar baku mutu (danger `#D92D20` di `#FEE4E2`, 4,01). Lolos: badge "Overdue" putih di merah solid 4,83; tombol "Unggah eviden" putih di merah 4,83. Mitigasi: status selalu berisi kata, sel abnormal juga tebal |
| R-26 kontrol | PASS | Setiap tombol dan tautan baru diuji dengan `userEvent` (unggah, hapus, selesaikan, hentikan dengan konfirmasi, simpan jadwal, filter, strip minggu, tab Riwayat, muat lebih banyak) |
| R-27 keadaan | PASS | Kalender, Eksekusi event, Atur jadwal, dan Riwayat punya memuat, kosong, dan galat dengan pesan Indonesia yang menyebut sebab |
| R-32 keyboard | SEBAGIAN | Elemen HTML asli. Input berkas disembunyikan secara visual (`ui-sr`) tetapi tetap bisa difokus; cincin fokus muncul di pembungkus label lewat `:focus-within`. Kartu event menampilkan cincin fokus lewat `:has(a:focus-visible)`. Wadah tabel berfokus (`tabindex=0`) agar bisa digulir dengan keyboard. Belum diuji manual dengan Tab di peramban sungguhan |
| R-35 verifikasi | SEBAGIAN | Dijalankan: tes, build, server nyata, Chrome nyata untuk tampilan, unggah multipart nyata. Pemilih berkas di peramban nyata dan HP sungguhan belum dicoba (unggah diuji lewat jsdom dan `curl`) |

Keamanan eviden yang diuji: tipe dari isi file (executable bernama `.jpg` ditolak), batas 10 MB tepat, file kosong, nama file berbahaya tidak bisa menyuntik header, unggah yang berbarengan dengan penyelesaian tidak masuk, unduhan butuh sesi, objek R2 hilang mengembalikan 404.

---

# Tambahan: kepadatan tampilan dan tata letak responsif

Permintaan pemilik produk: tampilan terasa terlalu besar. Perubahan: huruf isi 15 menjadi 14 px, kolom isian dan pemilih 52 menjadi 46 px (area ketik tetap 44 px), tombol 52 menjadi 44 px, padding kartu 16 menjadi 14 px, radius kartu 20 menjadi 16 px, judul kartu 17 menjadi 15 px, judul halaman 20 menjadi 17 px, angka KPI 28 menjadi 22 px, ikon dalam gelembung 18 px, tabel 14 menjadi 13 px, jarak antar-blok 16 menjadi 12 px. Judul `h2` di luar kartu sebelumnya memakai ukuran bawaan peramban (sekitar 21 px) dan kini 15 px.

Layar lebar (≥ 760 px): kartu modul dan angka dashboard 4 kolom, grafik dan stok bersebelahan (≥ 760 px), kalender dua kolom (≥ 900 px), halaman form tetap 600 px, daftar dan dashboard sampai 1040 px, rel samping 208 px.

Bukti (Chrome nyata, tinggi dokumen di 360 px, layar yang panjang): 10.183 px menjadi 9.203 px (-10%); Input Air 1.427 menjadi 1.272 (-11%); Atur jadwal berformulir 1.614 menjadi 1.470 (-9%); Pengguna 1.421 menjadi 1.252 (-12%). Tanpa overflow horizontal di 360, 390, 768, dan 1200 px. Tidak ada kontrol berinteraksi di bawah 44 px (saklar tetap 52x30 dengan area sentuh 44 px lewat `::after`).

Catatan jujur: skrip ukur sempat memotret halaman login pada putaran panjang (sesi tidak terbawa); kini skrip mendeteksi dan melaporkan hal itu, dan tiap layar yang dipakai sebagai bukti sudah dipastikan bukan halaman login. Penyebab kemacetan itu ada di skrip ukur, tidak terlihat di aplikasi.

---

# Tambahan: perbaikan permintaan pemilik produk (dropdown, form air, dashboard Admin, kalender bulan)

- **Dropdown Settling Pond:** ikon pin dan panah berada di luar elemen `<select>`, jadi ketukan di sana tidak membuka daftar (diukur di Chrome nyata: elemen penerima ketukan adalah `circle`, `svg`, dan `span`, bukan `select`). Sekarang seluruh kotak adalah `select` (ikon meneruskan ketukan); pengukuran ulang: `select` di semua titik. Kolom tanggal memakai pola yang sama. Di layar sentuh, huruf kolom 16 px agar iOS tidak memperbesar halaman saat fokus.
- **Form Air Permukaan:** tombol pemilih Inlet/Outlet dihapus; kedua blok ("Titik Inlet", "Titik Outlet") memang sudah tampil bersamaan karena atribut `hidden` kalah oleh CSS. Judul blok dipertahankan agar kolom pH dan TSS tidak ambigu.
- **Dashboard Admin:** beranda Admin kini dashboard yang sama dengan Manager, dengan tambahan grafik TSS inlet/outlet (garis baku mutu per pond), grafik curah hujan (batang per hari), dan kartu "Kalender bulan ini". Dashboard Manager ikut mendapat grafik dan kartu itu. API dashboard mengirim TSS dan curah hujan per hari (tanpa query tambahan, maksimal 6 per permintaan).
- **Kalender:** strip minggu diganti kisi sebulan penuh (Senin pertama), panah bulan, tanda merah/biru per hari; "hari ini" dan hari terpilih ditandai. Data dimuat untuk satu bulan penuh (<= 31 hari).
- Bukti: shared 58, api 189, web 204 tes lulus; Chrome nyata 360 dan 1200 px tanpa overflow dan tanpa target < 44 px.

---

# Tambahan: titik hijau, kuning, merah di kalender

Setiap hari menampilkan satu titik untuk tiap jenis event di hari itu: merah = overdue, kuning = menunggu (belum selesai, hari ini atau mendatang), hijau = selesai (termasuk selesai terlambat). Beberapa jenis dalam satu hari tampil berdampingan, urutan merah, kuning, hijau; titik biru yang lama dihapus. Warna mengikuti token status Figma (danger, warning, success). Warna bukan satu-satunya penanda: label tombol hari menyebutnya ("3 November, ada overdue, menunggu, selesai"), ada keterangan warna tertulis di bawah kisi ("Arti titik"), dan ringkasan kalender di dashboard memakai komponen yang sama. Titik adalah grafik kecil, bukan teks; kuning Figma `#D97706` berupa kuning tua/amber (rasio 3,2:1 terhadap putih).

---

# Tambahan: Bukti (kamera, geotag, layar Eviden)

Bukti (Chrome nyata, kamera buatan `--use-fake-device-for-media-stream`, lokasi buatan lewat CDP, 360 dan 1200 px):
- Kamera terbuka, video 640x480 berjalan, bilah info menampilkan `GPS -3.78421, 115.60214 ± 8 m` dan waktu WITA. Foto diambil dan diunggah; dibaca ulang dari server sebagai JPEG dengan cap `GPS -3.78421, 115.60214 - 2 Nov 2026 13:14 WITA` tertanam di gambar; koordinat, akurasi, dan waktu ambil tersimpan.
- Izin lokasi ditolak: dialog menampilkan "Lokasi tidak tersedia", foto tetap tersimpan, bercap "Tanpa lokasi", ditandai lencana "Tanpa lokasi".
- API: koordinat di luar rentang, waktu lama, waktu masa depan, lintang tanpa bujur, sumber tidak dikenal ditolak 400 berpesan Indonesia; sumber galeri membuang koordinat; Auditor ditolak mengunggah (403); rentang lebih dari satu tahun ditolak.
- Layar Eviden sebagai Auditor: kartu, filter, pratinjau (Escape menutup), ZIP terunduh (`eviden-2026-10-04-2026-11-02.zip`, 8 berkas, nama unik). Tanpa overflow horizontal dan tanpa target di bawah 44 px pada kamera, penampil, Eksekusi event, dan layar Eviden di 360 dan 1200 px.
- Tes: shared 58, API 223, web 301 lulus.

Belum diuji: kamera dan GPS di HP sungguhan (butuh HTTPS setelah deploy) dan konteks tidak aman di peramban nyata (dicakup tes unit). Nama berkas foto kamera memakai jam UTC (`foto-202611020514.jpg`), sedangkan tampilan memakai WITA.

---

# Tambahan: Laporan, grafik, dan ekspor

Bukti (Chrome nyata, data contoh satu tahun di pond SP-02, Manager, 360 dan 1200 px):
- Layar Laporan memuat sembilan grafik berlabel data (86 label), tabel pratinjau dengan sel merah untuk pH outlet 5,8 dan TSS outlet 55, tanpa overflow horizontal dan tanpa target di bawah 44 px. Dashboard juga berlabel.
- Excel dibuka ulang dengan `openpyxl`: lembar Ringkasan, Cuaca, Air Permukaan, Koagulan; judul dibekukan; angka bertipe angka; dua sel di luar baku mutu berwarna merah tebal.
- PDF 7 halaman dengan 9 gambar grafik, legenda, sel merah, dan "Halaman x dari y"; halaman dirender dengan PDFKit dan dibaca.
- Operator membuka `/laporan` mendarat di beranda; Auditor melihat Laporan.
- Pustaka PDF berada di potongan terpisah (`jspdf.es.min`, `jspdf.plugin.autotable`) yang dirujuk hanya lewat `import()`; potongan utama 295 kB.
- Tes: web 417, API 224, shared 58.

Temuan yang diperbaiki selama verifikasi: label sumbu kiri terpotong untuk angka lima digit (debit), dua label bulan terakhir bertumpuk, pemilih Periode melebihi lebar 360 px. Catatan jujur: satu pengukuran awal menunjukkan overflow karena peramban menyajikan CSS lama dari cache service worker; setelah profil memuat versi baru, tidak ada overflow.

Catatan: label di dekat titik abnormal merah pada grafik garis bisa menempel pada titik. Cache PWA mengunduh potongan PDF di latar belakang saat pemasangan.

---

# Tambahan: PDF laporan bergaya slide

Bukti (Chrome nyata, Manager, data contoh satu tahun, pond SP 11 LGG dan SP-02; PDF dirender dengan PDFKit dan dibandingkan dengan `Design/Laporan Cuaca.pdf` dan `Design/Laporan pond.pdf`):
- Ekspor satu pond menghasilkan 2 halaman (Cuaca, "SP 11 LGG MONITORING"); "Semua lokasi" menghasilkan 4 halaman, satu halaman pond per pond berdata, urut menurut kode. Tidak ada pesan galat.
- Halaman Cuaca: banner merah, tabel dua tingkat dengan sel persik dan intensity merah, baris ringkasan kuning ("5 hari hujan | 44,0 mm | 21,0 hrs | 2,3 mm/hrs"), tiga grafik 1W, 1M (total per minggu), 1Y (total per bulan) berlabel kotak. Halaman pond: empat panel hijau (pH dengan garis pH Min dan pH Max, TSS dengan garis BML MHU, Debit L/s, koagulan), kolom Summary Penggunaan Koagulan (WEEKLY, MTD, MONTHLY, YTD, Year To Date, Project To Date).
- Selisih disengaja terhadap sampel: tanpa batang oranye, footer, kotak nomor halaman, logo, dan kolom Shift (keputusan pemilik produk); nama bulan Inggris tiga huruf; hari tanpa catatan cuaca tampil 0,0.
- Selisih yang ditemukan dan diperbaiki saat verifikasi: legenda TSS terpotong (legenda kini mengecil agar muat), label angka bertumpuk pada batang pH dan debit serta garis YTD (label dinaikkan bila sejajar), label biru menimpa sumbu tanggal (dipindah ke atas titik), kolom kanan menyisakan ruang kosong (grafik MTD dan YTD diperbesar).
- Tes: shared 58, API 234, web 465 lulus; `tsc` bersih; `jspdf` tetap potongan terpisah.

Catatan: pada grafik 1W, label rainfall dan durasi yang nilainya berdekatan saling menimpa (sama seperti sampel). Garis baku mutu TSS bisa melewati label batang kecil. Tidak diuji di HP sungguhan.

---

# Tambahan: Antrean luring dan sinkronisasi (Bagian 5)

Bukti (Chrome nyata, server uji dimatikan sungguhan lalu dinyalakan lagi, Operator, layar 390 px, service worker aktif):
- Setelah satu kali dibuka online, Input Cuaca, Air, Koagulan dan Eksekusi event terbuka tanpa server (cache baca `evo-api`). Simpan menampilkan "Tersimpan di HP, menunggu sinyal"; foto dan "Selesaikan event" masuk antrean dengan lencana "Menunggu unggah".
- Muat ulang saat offline: antrean tetap ada ("Mengunggah 5…"). Keluar akun dengan antrean meminta konfirmasi ("Ada 5 data belum terunggah") dan Batal tetap masuk.
- Server kembali: cuaca 12,5 mm, koagulan 5 kg, dan event terunggah sendiri; event berstatus selesai dengan satu eviden (tanpa ganda); antrean dan chip kosong. Edit lebih baru dari perangkat lain (pH 6,1, 3 menit di depan jam HP) tidak tertimpa entri antrean pH 7,7. Item milik pengguna lain di HP yang sama tidak disentuh.
- Foto ditolak server (berkas bukan gambar): ditandai "gagal" dengan pesan server, tidak dicoba ulang, "Selesaikan event" tetap menunggu; item lain tidak terganggu.
- Tes: shared 58, API 256, web 530+ lulus.

Temuan yang diperbaiki selama verifikasi: setelah sinyal kembali, unggah tertahan karena jeda coba ulang terus bertambah saat offline dan acara `online` tidak menghapusnya (kini acara `online` dan tab kembali terlihat memaksa satu putaran, jeda tanpa sinyal maksimal 30 detik; dua tes baru). Dua kegagalan awal berasal dari skrip uji saya sendiri (mematikan proses Chrome saat mematikan server; berkas uji bukan gambar), bukan dari aplikasi.

Belum diuji: HP sungguhan (butuh HTTPS setelah deploy), unggah saat aplikasi tertutup (tidak didukung), foto kamera offline di peramban nyata (jalur antrean sama dengan galeri, diuji unit). Jadwal uji "Uji luring ..." dan pond "SP 11" tertinggal di database lokal pengembangan.
