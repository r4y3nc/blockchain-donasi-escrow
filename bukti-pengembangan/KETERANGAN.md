# Bukti dari lingkungan pengembangan

| Berkas | Isi |
|---|---|
| log-test-pengembangan.txt | Keluaran `hardhat test --gas-stats` untuk test/DonationEscrow.ts (20 test lulus) dan tabel gas |
| hasil-mutasi.txt | Hasil uji mutasi: 12 kerusakan kontrak yang sengaja disisipkan, 12 terdeteksi oleh test |

Lingkungan: Node 24.14.1, Hardhat 3.19.0, solc 0.8.34 (paket npm, WASM), jaringan simulasi lokal.
Bukti resmi untuk laporan adalah log eksekusi pada mesin pengguna di folder bukti-pengguna.
