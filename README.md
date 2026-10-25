# DonationEscrow: Escrow Donasi Berbasis Milestone

Prototype Hardhat untuk UAS Blockchain (KP70067008) kelompok. Judul: DonationEscrow, Escrow Donasi Berbasis Milestone dengan Audit Keamanan dan Evaluasi Arsitektur.

## Anggota

| Nama | NPM | GitHub | Peran |
|---|---|---|---|
| Icep Septian Fajar | 237006056 | r4y3nc | Kontrak, pengujian, audit, dan skrip deployment |
| Erdin Nurhidayat | 237006063 | erdin33 | Antarmuka dan integrasi wallet |

Program Studi Informatika, Universitas Siliwangi. Dosen pengampu: Dr. Ir. Nur Widiyasono, M.Kom.

## Deskripsi

Kontrak `DonationEscrow` menahan dana per kampanye dan melepasnya per milestone setelah disetujui verifikator dan challenge window berakhir. Lama challenge window bawaan adalah dua hari dan dapat diubah Regulator untuk kampanye yang dibuat sesudahnya. Lima peran dicakup, yaitu donatur, penghimpun, pelaksana, verifikator, dan Regulator. Dana dilepas dengan pola pull payment, yaitu dikreditkan ke saldo `claimable` lalu ditarik dengan `withdraw`. Kontrak hanya menyimpan alamat, angka, hash, dan status.

Prototype hanya berjalan di jaringan simulasi lokal Hardhat. Dana yang ditahan adalah mata uang native jaringan uji dan bernilai dummy. Tidak ada mainnet, testnet, dana nyata, atau private key pribadi.

## Status versi

| Versi | Keterangan | Commit |
|---|---|---|
| v2 | Kontrak awal, objek audit | 9a37e8d |
| v4 | Kontrak setelah perbaikan temuan A-01 sampai A-05 | 7bd69d4 dan 06f659c |

Versi v3 adalah keadaan antara setelah A-01, A-02, A-04, dan A-05, sebelum perbaikan A-03. Versi v3 hanya muncul pada bukti retest.

## Isi

| Berkas | Fungsi |
|---|---|
| `contracts/DonationEscrow.sol` | Kontrak utama |
| `contracts/mocks/ReentrancyAttacker.sol` | Kontrak bantu uji reentrancy, bukan bagian sistem |
| `test/DonationEscrow.ts` | 25 test. Judul memuat ID test, kebutuhan, dan ID temuan audit |
| `scripts/deploy.ts` | Deployment ke node lokal dan penyiapan peran awal |
| `scripts/demo.ts` | Alur end-to-end satu milestone dengan pencatatan hash dan event |
| `scripts/buat-record.mjs` | Menyusun `deployment/Deployment_Record.md` |
| `scripts/cek-lingkungan.mjs` | Pemeriksaan lingkungan mesin |
| `deployment/` | Hasil deployment, ABI untuk frontend, dan Deployment Record |
| `bukti-audit/` | Log PoC, Slither, retest, mutasi perbaikan, dan gas untuk audit |
| `bukti-pengembangan/` | Log test dan uji mutasi v2 dari lingkungan pengembangan |
| `bukti-pengguna/` | Log eksekusi pada mesin pengguna |
| `frontend/` | Antarmuka web. Lihat bagian Frontend |

## Versi yang dikunci

| Komponen | Versi |
|---|---|
| Hardhat | 3.19.0 |
| Compiler Solidity | 0.8.34 dengan optimizer 200 runs |
| OpenZeppelin Contracts | 5.6.1, hanya ReentrancyGuard |
| ethers | 6.17.0 |
| Mocha, Chai | 12.0.3, 6.3.0 |
| TypeScript | 6.0.3 |
| Node.js | 24.14.1 |
| Slither | 0.11.6, hanya untuk audit |
| React, Vite (frontend) | rentang ^18.3.1 dan ^5.4.11 pada `frontend/package.json` |
| MetaMask | 13.53.0 |

Semua versi npm terkunci pada `package-lock.json` di root dan di `frontend/`. Gunakan `npm ci`.

## Konfigurasi

| Hal | Nilai |
|---|---|
| Jaringan | Hardhat Localhost, `http://127.0.0.1:8545` |
| Chain ID | 31337 |
| Akun | Akun uji bawaan Hardhat. Tidak ada file `.env` dan tidak ada variabel rahasia |
| Akhir baris | LF, dipaksa oleh `.gitattributes`. Akhir baris CRLF mengubah metadata bytecode sehingga hash transaksi deployment berbeda |

## Langkah menjalankan test

```
npm ci
npm run cek
npm run compile
npm test
npm run test:gas
npx hardhat test --coverage
```

Kompilasi pertama membutuhkan internet untuk mengunduh compiler Solidity. Setelah itu semuanya berjalan lokal.

Hasil yang diharapkan pada v4:

| Perintah | Hasil |
|---|---|
| `npm run cek` | Semua baris berstatus OK atau INFO, tanpa GAGAL, dan akhir baris kontrak LF |
| `npm run compile` | Kompilasi berhasil |
| `npm test` | 25 test lulus |
| `npm run test:gas` | 25 test lulus, deployment 2.646.629 gas, ukuran kontrak 11.784 byte |
| `npx hardhat test --coverage` | 25 test lulus. `DonationEscrow.sol` 89,45 persen baris dan 91,32 persen statement. Laporan ditulis ke folder `coverage/` yang diabaikan git |

## Langkah deployment lokal

Buka dua terminal pada folder proyek.

```
# Terminal 1
npm run node

# Terminal 2
npm run deploy:local
npm run demo:local
npm run record
```

| Perintah | Hasil |
|---|---|
| `npm run node` | Node lokal pada `http://127.0.0.1:8545` dengan chain ID 31337 dan akun uji bawaan |
| `npm run deploy:local` | Kontrak dideploy dan peran awal disetujui. Menulis `deployment/deployment-record.json` dan `deployment/DonationEscrow.json`, lalu menyalin ABI ke `frontend/src/contract/DonationEscrow.json` |
| `npm run demo:local` | Menjalankan satu milestone penuh dan menulis `deployment/demo-record.json` |
| `npm run record` | Menyusun `deployment/Deployment_Record.md` |

Pada node bersih, alamat kontrak adalah `0x5FbDB2315678afecb367f032d93F642f64180aa3` dan hash transaksi deployment adalah `0x6c040fed2b3b5020d75ffadcad209d9fa526258f0740bc5e469d46f2f8836846`. Hash transaksi `createCampaign` berbeda tiap eksekusi karena memuat tenggat berbasis waktu.

Catatan: `demo:local` memajukan waktu node dua hari untuk melewati challenge window. Untuk keadaan awal yang bersih, hentikan node lalu jalankan ulang dari Terminal 1.

## Frontend

Antarmuka dibangun dengan Vite, React, TypeScript, dan ethers 6. Antarmuka membaca alamat kontrak, chain ID, dan ABI dari `frontend/src/contract/DonationEscrow.json`, yang disalin otomatis oleh `npm run deploy:local`. Antarmuka memanggil 11 fungsi kontrak yang mengubah state. Fungsi Regulator tidak tersedia pada antarmuka dan dijalankan melalui skrip dan test.

Langkah menjalankan frontend, setelah node lokal aktif dan kontrak dideploy:

```
cd frontend
npm ci
npm run dev
```

Aplikasi berjalan pada `http://localhost:3000`. Ada dua cara terhubung ke node lokal:

1. MetaMask. Tambahkan jaringan secara manual dengan nama `Hardhat Localhost`, URL RPC `http://127.0.0.1:8545`, chain ID `31337`, dan simbol `ETH`. Impor akun uji dengan private key dummy dari keluaran `npm run node`, lalu pilih Hubungkan Dompet.
2. Mode simulasi. Antarmuka memakai akun uji Hardhat langsung melalui node lokal, tanpa MetaMask.

## Ringkasan audit

Audit pada v2 menemukan lima temuan. Semuanya diperbaiki pada v4 dan masing-masing dibuktikan oleh satu test.

| ID | Temuan | Test | Commit |
|---|---|---|---|
| A-01 | Sengketa berulang oleh donatur ambang | TC-20 | 7bd69d4 |
| A-02 | Tenggat pendanaan tanpa batas atas | TC-21 | 7bd69d4 |
| A-03 | Jendela waktu global berlaku surut | TC-24 | 06f659c |
| A-04 | Keputusan sengketa tanpa hash dokumen | TC-22 | 7bd69d4 |
| A-05 | Jendela verifikasi berjalan saat sengketa | TC-23 | 7bd69d4 |

Rincian ada pada Security_Audit.pdf dan folder `bukti-audit/`.

## Batas pemeriksaan

- Jaringan simulasi Hardhat berjalan satu node, sehingga konsensus, finalitas, dan serangan jaringan tidak diuji.
- Angka gas berasal dari simulasi lokal pada skenario test, bukan estimasi biaya jaringan nyata.
- TC-17 adalah inspeksi ABI, bukan uji perilaku.
- Audit dilakukan oleh pembuat kontrak dengan bantuan alat, sehingga bukan audit independen. Tidak ada fuzzing atau verifikasi formal.
- Cakupan test untuk `DonationEscrow.sol` adalah 89,45 persen baris dan 91,32 persen statement. Baris yang belum dijalankan test belum dianalisis satu per satu.
- Hash metadata kampanye pada antarmuka belum berasal dari data kampanye.
- Log di `bukti-pengembangan/` berasal dari v2 dan dibuat pada lingkungan pengembangan dengan compiler dari paket npm. Hasil resmi untuk v4 adalah keluaran `npm test` dan `npm run test:gas` pada mesin pengguna.

## Keamanan dan data

- Semua alamat dan akun adalah akun uji bawaan Hardhat. Kunci pribadi akun uji tidak disimpan pada repositori.
- Tidak ada file `.env` dan tidak ada variabel rahasia yang dibutuhkan.
- Kontrak tidak menyimpan data pribadi. Hanya alamat, angka, hash, dan enum yang tercatat.
