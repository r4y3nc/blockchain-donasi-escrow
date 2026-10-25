# Security Audit DonationEscrow

Audit keamanan dan bukti perbaikan kontrak DonationEscrow untuk UAS Blockchain (KP70067008).

| Hal | Keterangan |
|---|---|
| Proyek | DonationEscrow: Escrow Donasi Berbasis Milestone dengan Audit Keamanan dan Evaluasi Arsitektur |
| Auditor | Icep Septian Fajar, 237006056 |
| Tanggal | 22 Oktober 2026, sesuai commit bukti 98b032b |
| Repositori | https://github.com/r4y3nc/blockchain-donasi-escrow |
| Objek audit | `contracts/DonationEscrow.sol` v2, 506 baris, md5 89aa1e05d5f59a2a37537a0c05e67009, commit 9a37e8d |
| Hasil perbaikan | v4, md5 9d96dacc3f4ea1508399b97a5a3332d6, commit 7bd69d4 dan 06f659c |
| Lingkungan kontrak | Solidity 0.8.34 dengan optimizer 200 runs, OpenZeppelin Contracts 5.6.1 |

## 1 Ringkasan

Audit pada v2 menemukan lima temuan keamanan, yaitu A-01 sampai A-05. Kelima temuan dibuktikan dengan proof of concept (PoC), diperbaiki pada v4, dan diuji ulang. Tidak ada temuan berkategori reentrancy atau access control pada fungsi.

Tabel 1 Ringkasan Hasil Audit

| Item | Nilai |
|---|---|
| Temuan keamanan | 5, dengan tingkat Sedang satu, Rendah sampai Sedang dua, dan Rendah dua |
| Temuan ditutup | 5 dari 5 |
| Catatan informasi | 5, yaitu I-01 sampai I-05 |
| Hasil Slither 0.11.6 | 9 hasil non-keamanan pada v2, v3, dan v4 |
| Test otomatis | 25 lulus, naik dari 20 |
| Gas deployment | 2.646.629, naik 128.600 dari 2.518.029 pada v2 |
| Ukuran bytecode | 11.784 byte, naik dari 11.189 byte, dan batas ukuran kontrak 24.576 byte |

Tingkat temuan adalah penilaian argumentatif. Angka lain terukur dari berkas bukti yang disebut pada Bagian 8.

## 2 Objek dan Metode

Audit dilakukan dengan tiga metode:

1. Tinjauan manual baris demi baris terhadap v2.
2. Analisis statis dengan Slither 0.11.6.
3. Lima PoC yang dijalankan pada jaringan simulasi lokal Hardhat dengan akun uji.

Perbaikan diverifikasi dengan test baru, retest PoC lama pada v3 dan v4, serta uji mutasi yang mencabut tiap perbaikan satu per satu.

## 3 Threat Model

### 3.1 Aset

| Aset | Lokasi | Dampak bila rusak |
|---|---|---|
| Dana escrow, yaitu `totalRaised` dikurangi `releasedGross` | Saldo kontrak | Dana donatur hilang atau terkunci |
| Saldo `claimable` pelaksana dan penghimpun | Mapping `claimable` | Penerima tidak dapat menarik dana |
| Status kampanye dan milestone | Storage kontrak | Pencairan keliru atau tertahan |
| Parameter global dan alamat Regulator | Storage dan immutable | Perlindungan donatur melemah |

### 3.2 Aktor dan batas kepercayaan

| Aktor | Dipercaya untuk | Tidak dipercaya untuk |
|---|---|---|
| Regulator | Menyetujui peran, memutus sengketa, menjeda kontrak, dan mengubah parameter | Selalu tersedia atau selalu jujur |
| Penghimpun | Membuat kampanye | Menarik dana escrow langsung |
| Verifikator | Menilai bukti milestone | Menilai dengan benar tanpa kolusi |
| Pelaksana | Mengirim hash bukti | Kebenaran isi dokumen bukti |
| Donatur | Berdonasi dan meminta refund | Membuka sengketa tanpa batas |
| Penyerang umum | Tidak ada | Semua panggilan publik |

### 3.3 Skenario penyalahgunaan

| ID | Skenario | Hasil pemeriksaan |
|---|---|---|
| S-1 | Penyerang memakai reentrancy pada `refund` atau `withdraw` | Tidak berhasil, lihat Bagian 3.4 |
| S-2 | Donatur ambang membekukan kampanye berulang kali | Berhasil, menjadi A-01 |
| S-3 | Penghimpun menetapkan tenggat pendanaan sangat jauh untuk mengunci dana | Berhasil, menjadi A-02 |
| S-4 | Parameter jendela diubah saat milestone berjalan | Berhasil, menjadi A-03 |
| S-5 | Regulator memutus sengketa tanpa dokumen keputusan | Berhasil, menjadi A-04 |
| S-6 | Eskalasi dipanggil sebelum verifikator sempat menilai setelah sengketa | Berhasil, menjadi A-05 |
| S-7 | Penghimpun menarik dana escrow tanpa persetujuan | Tidak berhasil, dibuktikan TC-05 |
| S-8 | Verifikator yang dicabut tetap menyetujui | Tidak berhasil, dibuktikan TC-12 |

### 3.4 Cakupan pemeriksaan

| Aspek | Hasil | Dasar |
|---|---|---|
| Reentrancy | Tidak ditemukan celah | `refund` dan `withdraw` memakai `nonReentrant` dan memperbarui state sebelum transfer. Slither tidak melaporkan reentrancy. TC-16a dan TC-16b lulus |
| Access control | Tidak ditemukan celah pada fungsi. Kewenangan Regulator yang luas dibahas pada A-03 | Fungsi sensitif dibatasi `onlyRegulator` atau peran kampanye. TC-03, TC-05, TC-06, dan TC-12 lulus |
| Front-running dan urutan transaksi | Risiko rendah tanpa perubahan kode | Tidak ada harga atau pertukaran yang dapat dimanipulasi. Verifikator yang akan dicabut dapat menyetujui lebih dahulu, tetapi pelepasan masih tertahan challenge window dan dapat disengketakan |
| Oracle | Tidak relevan | Kontrak tidak membaca data eksternal. Keputusan verifikator merupakan masukan manusia |
| Denial of service | Ditemukan A-01 dan A-02 | Pola pull payment mencegah penerima menahan alur. Perulangan dibatasi 10 milestone dan tidak ada array tanpa batas |
| Validasi masukan | Ditemukan A-02 dan A-04 | Total porsi, biaya operasional, alamat nol, indeks milestone, dan hash bukti nol sudah divalidasi |
| Penanganan galat | Tidak ditemukan celah | Custom error dipakai, transfer yang gagal membatalkan transaksi, dan refund bernilai nol tidak memanggil transfer |

## 4 Temuan

Dampak dan kemungkinan dinilai secara argumentatif pada skala Rendah, Sedang, dan Tinggi. Tingkat adalah gabungan keduanya.

### A-01 Sengketa dapat dibuka berulang

| Hal | Keterangan |
|---|---|
| Fungsi terdampak | `openDispute` dan `resolveDispute` |
| Deskripsi | Donatur ambang dapat membuka sengketa kembali setelah Regulator melanjutkan kampanye. Kampanye berulang kali berstatus Disputed dan pencairan tertunda |
| Bukti | PoC-A01, lima pembekuan berturut-turut dengan biaya hanya gas |
| Dampak | Sedang, dana tidak hilang tetapi pencairan tertunda |
| Kemungkinan | Sedang, cukup satu donatur dengan kontribusi 5 persen |
| Tingkat | Sedang |
| Rekomendasi | Satu sengketa per donatur per kampanye |
| Perbaikan | Mapping `disputeUsed` dan galat `DisputeAlreadyUsed`. Commit 7bd69d4 |
| Test | TC-20 |

### A-02 Tenggat pendanaan tanpa batas atas

| Hal | Keterangan |
|---|---|
| Fungsi terdampak | `createCampaign` |
| Deskripsi | `fundingDeadline` tidak memiliki batas atas. Tenggat yang sangat jauh menahan donasi tanpa jalan refund selain pembatalan Regulator |
| Bukti | PoC-A02, tenggat 1000 tahun tidak dapat difinalisasi |
| Dampak | Sedang, dana donatur terkunci |
| Kemungkinan | Rendah, penghimpun harus disetujui Regulator |
| Tingkat | Rendah sampai Sedang |
| Rekomendasi | Batasi tenggat paling lama `MAX_WINDOW` dari waktu pembuatan |
| Perbaikan | `createCampaign` menolak tenggat yang melebihi waktu blok ditambah 365 hari. Commit 7bd69d4 |
| Test | TC-21 |

### A-03 Parameter jendela global dan berlaku surut

| Hal | Keterangan |
|---|---|
| Fungsi terdampak | `setParams`, `release`, dan `escalate` |
| Deskripsi | Parameter jendela bersifat global, sehingga Regulator dapat memperpendek challenge window pada milestone yang sedang berjalan |
| Bukti | PoC-A03, pelepasan berhasil setelah 2 detik |
| Dampak | Sedang, perlindungan donatur melemah |
| Kemungkinan | Rendah, memerlukan Regulator yang tidak jujur |
| Tingkat | Rendah sampai Sedang |
| Rekomendasi | Simpan jendela per kampanye saat dibuat |
| Perbaikan | Jendela verifikasi dan challenge disalin ke `campaignWindows` saat kampanye dibuat, dan `release` serta `escalate` memakai nilai itu. Commit 06f659c |
| Test | TC-24 |

### A-04 Putusan sengketa menerima hash nol

| Hal | Keterangan |
|---|---|
| Fungsi terdampak | `resolveDispute` |
| Deskripsi | `decisionHash` bernilai nol diterima, sehingga keputusan dapat dicatat tanpa dokumen |
| Bukti | PoC-A04 |
| Dampak | Rendah, memengaruhi akuntabilitas dan bukan dana |
| Kemungkinan | Rendah sampai Sedang |
| Tingkat | Rendah |
| Rekomendasi | Tolak hash nol |
| Perbaikan | `resolveDispute` menolak hash nol dengan galat `ZeroHash`. Commit 7bd69d4 |
| Test | TC-22 |

### A-05 Jendela verifikasi berjalan saat sengketa

| Hal | Keterangan |
|---|---|
| Fungsi terdampak | `resolveDispute` dan `escalate` |
| Deskripsi | Jendela verifikasi tetap berjalan selama Disputed, sehingga eskalasi dapat dipanggil segera setelah sengketa dilanjutkan, sebelum verifikator sempat menilai |
| Bukti | PoC-A05 |
| Dampak | Rendah, eskalasi tidak melepas dana dan Regulator dapat mengatur ulang lewat `replaceVerifier` |
| Kemungkinan | Sedang |
| Tingkat | Rendah |
| Rekomendasi | Atur ulang `submittedAt` milestone berstatus Submitted saat sengketa dilanjutkan |
| Perbaikan | `submittedAt` diatur ulang pada `resolveDispute` bila sengketa dilanjutkan. Commit 7bd69d4 |
| Test | TC-23 |

## 5 Catatan Informasi

| ID | Catatan | Penilaian |
|---|---|---|
| I-01 | Pragma `^0.8.34` tidak dikunci pada berkas kontrak | Kompilasi dikunci ke 0.8.34 oleh konfigurasi proyek. Rekomendasi mengunci pragma |
| I-02 | Slither divide-before-multiply pada `release`, yaitu `op = (gross * c.opCostBps) / BPS` | Disengaja. Pembulatan ke bawah pada biaya operasional dan tidak menyebabkan kekurangan dana |
| I-03 | Slither uninitialized-local pada `total` di `_validateShares` | Positif palsu, karena variabel bertipe uint bernilai awal nol |
| I-04 | Slither timestamp pada lima perbandingan | Jendela berukuran hari, sehingga selisih detik oleh proposer tidak berdampak material |
| I-05 | Slither low-level-calls pada `refund` dan `withdraw` | Disengaja, dan dilindungi `nonReentrant` serta efek sebelum interaksi |

Hasil mentah Slither adalah 9 hasil, yaitu I-02 satu, I-03 satu, I-04 lima, dan I-05 dua. Tidak ada hasil berkategori reentrancy, access control, atau pengiriman dana ke alamat sembarang. Jenis hasil sama pada v2, v3, dan v4.

## 6 Verifikasi Perbaikan

### 6.1 Retest proof of concept

| Pengujian | Hasil |
|---|---|
| PoC pada v2 | 5 dari 5 lulus, artinya perilaku berbahaya terjadi |
| PoC lama pada v3 | 4 gagal dan PoC-A03 lulus, karena A-03 baru diperbaiki pada v4 |
| PoC lama pada v4 | 5 dari 5 gagal, termasuk PoC-A03 |

Pada retest PoC, hasil gagal berarti celah tertutup, karena PoC menegaskan terjadinya perilaku berbahaya.

### 6.2 Uji mutasi

Tiap perbaikan dicabut satu per satu, lalu seluruh test dijalankan.

| Mutasi | Perbaikan yang dicabut | Test yang gagal | Test lain |
|---|---|---|---|
| M-A01 | Pemeriksaan `disputeUsed` | TC-20 | 23 lulus |
| M-A02 | Batas atas tenggat | TC-21 | 23 lulus |
| M-A03 | Penyalinan jendela per kampanye | TC-24 | 24 lulus |
| M-A04 | Penolakan hash nol | TC-22 | 23 lulus |
| M-A05 | Pengaturan ulang jendela verifikasi | TC-23 | 23 lulus |

Setiap pencabutan membuat tepat satu test gagal, yaitu test perbaikan itu sendiri. Jumlah test lulus adalah 23 untuk M-A01, M-A02, M-A04, dan M-A05, serta 24 untuk M-A03 karena TC-24 ditambahkan sesudahnya.

### 6.3 Biaya perbaikan

| Ukuran | v3 | v4 |
|---|---|---|
| Rata-rata gas `createCampaign` | 234.677 | 256.949 |
| Rata-rata gas `release` | 91.807 | 94.911 |
| Gas deployment | tidak diukur pada v3 | 2.646.629 |
| Ukuran bytecode | tidak diukur pada v3 | 11.784 byte |

## 7 Dampak Perbaikan

Perbaikan A-03 mengubah perilaku Regulator. Perubahan parameter hanya berlaku untuk kampanye yang dibuat sesudahnya, sehingga jendela kampanye berjalan tidak dapat diperpanjang, misalnya pada keadaan darurat. Kewenangan atas parameter kampanye baru dan pause tetap ada. Kunci Regulator pada produksi disarankan dipegang secara multisig.

Perbaikan menambah galat `DisputeAlreadyUsed` serta getter `disputeUsed` dan `campaignWindows` pada ABI. Tanda tangan fungsi dan struktur `getCampaign` tidak berubah, dan antarmuka memakai kedua getter itu setelah ABI disalin otomatis.

## 8 Bukti

| Berkas | Isi |
|---|---|
| `bukti-audit/poc-temuan.ts` dan `poc-log.txt` | Lima PoC dan hasilnya pada v2 |
| `bukti-audit/retest-poc.txt` | Retest PoC lama pada v3 |
| `bukti-audit/retest-a03-poc.txt` | Retest PoC lama pada v4 |
| `bukti-audit/retest-mutasi.txt` dan `retest-a03-mutasi.txt` | Uji mutasi perbaikan |
| `bukti-audit/slither-log.txt`, `slither-log-v3.txt`, dan `slither-log-v4.txt` | Keluaran Slither |
| `bukti-audit/gas-v3.txt` dan `gas-v4.txt` | Hasil test dan gas |
| `bukti-pengguna/log-eksekusi-pengguna.txt` | Eksekusi v2 pada mesin pengguna |

Seluruh berkas bukti ada pada commit 98b032b. Perbaikan dapat ditelusuri ke commit 7bd69d4 untuk A-01, A-02, A-04, dan A-05, serta 06f659c untuk A-03.

## 9 Keterbatasan

1. Audit dilakukan oleh pembuat kontrak dengan bantuan alat, sehingga bukan audit independen.
2. Cakupan hanya tinjauan manual, Slither, PoC, dan uji mutasi pada perbaikan. Tidak ada fuzzing, pengujian invariant, atau verifikasi formal.
3. Konsensus, finalitas, dan serangan jaringan tidak diuji karena prototipe berjalan pada satu node.
4. Keberlangsungan kampanye bergantung pada Regulator, termasuk saat pelaksana tidak aktif dan saat siklus tolak lalu ajukan ulang berlangsung tanpa batas.
5. Angka gas dan ukuran bytecode terukur pada jaringan simulasi Hardhat lokal.
6. Retest PoC, uji mutasi, dan Slither dijalankan pada lingkungan sandbox dan belum dijalankan ulang di mesin pengembang. Hasil 25 test lulus dan angka gas v4 sudah dikonfirmasi di mesin pengembang dan sama dengan hasil sandbox.
7. Log retest PoC hanya memuat status gagal dan tidak memuat pesan galat, sehingga penyebab kegagalan dibuktikan tidak langsung oleh uji mutasi.
