# Escrow Donasi Berbasis Milestone (prototype Hardhat)

Artefak teknis untuk Tugas Perseorangan Blockchain (KP70067008).
Kasus: escrow donasi berbasis milestone dengan verifikator independen untuk penghimpun sumbangan.

Prototype hanya berjalan di jaringan simulasi lokal Hardhat. Dana yang ditahan adalah mata uang
native jaringan uji (dummy). Tidak ada mainnet, testnet, dana nyata, atau private key pribadi.

## Isi

| Berkas | Fungsi |
|---|---|
| `contracts/DonationEscrow.sol` | Kontrak utama |
| `contracts/mocks/ReentrancyAttacker.sol` | Kontrak bantu uji serangan reentrancy (bukan bagian sistem) |
| `test/DonationEscrow.ts` | 20 test; judul memuat ID test dan REQ yang diuji |
| `scripts/cek-lingkungan.mjs` | Pemeriksaan lingkungan mesin |
| `bukti-pengembangan/` | Log test dan hasil uji mutasi dari lingkungan pengembangan |
| `bukti-pengguna/` | Log eksekusi npm ci, compile, test, dan test:gas pada mesin pengguna |

## Versi yang dikunci

| Komponen | Versi |
|---|---|
| Hardhat | 3.19.0 |
| Compiler Solidity | 0.8.34 (diunduh Hardhat saat kompilasi pertama), optimizer aktif 200 runs |
| OpenZeppelin Contracts | 5.6.1 (hanya ReentrancyGuard) |
| ethers | 6.17.0 |
| Mocha, Chai | 12.0.3, 6.3.0 |
| TypeScript | 6.0.3 |
| Node.js | 24.14.1 pada mesin pengguna, 22.22.0 pada lingkungan pengembangan untuk instalasi |

Semua versi terkunci di `package-lock.json`. Gunakan `npm ci`, bukan `npm install`.

## Langkah menjalankan

```
npm ci
npm run cek
npm run compile
npm test
npm run test:gas
```

Kompilasi pertama membutuhkan internet untuk mengunduh compiler Solidity. Setelah itu semuanya
berjalan lokal. Di mesin tanpa instruksi AVX, Hardhat memakai compiler versi WASM secara otomatis.

## Hasil yang diharapkan

| Perintah | Hasil |
|---|---|
| `npm run cek` | Semua baris berstatus OK atau INFO, tanpa GAGAL |
| `npm run compile` | Kompilasi berhasil |
| `npm test` | 20 test lulus |
| `npm run test:gas` | 20 test lulus ditambah tabel gas per fungsi |

## Batas pemeriksaan

- Log pada `bukti-pengembangan/` dibuat pada lingkungan pengembangan dengan compiler solc 0.8.34 dari paket npm (WASM)
  pada Node 24.14.1, karena unduhan compiler diblokir di lingkungan pengembangan. Versi compiler dan
  sumber kontrak sama. Hasil resmi untuk laporan adalah log pada `bukti-pengguna/`.
- Jaringan simulasi Hardhat berjalan satu node dan tidak menjalankan konsensus QBFT. Sifat konsensus
  pada laporan adalah klaim tingkat rancangan, bukan hasil uji.
- Angka gas berasal dari simulasi lokal pada skenario test, bukan estimasi biaya jaringan nyata.
- TC-17 adalah inspeksi ABI, bukan uji perilaku.

## Keamanan dan data

- Semua alamat dan akun adalah akun uji bawaan Hardhat (dummy).
- Tidak ada file `.env` dan tidak ada variabel rahasia yang dibutuhkan.
- Kontrak tidak menyimpan data pribadi: hanya alamat, angka, hash, dan enum.
