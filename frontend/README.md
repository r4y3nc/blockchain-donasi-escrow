# Frontend AmanahEscrow

Aplikasi antarmuka pengguna (dApp) untuk platform donasi berbasis milestone dan verifikator independen pada smart contract `DonationEscrow`.

## Panduan Menjalankan

### 1. Prasyarat
- Node.js versi 20+ atau 24+
- Browser dengan ekstensi Web3 (seperti MetaMask atau Rabby)
- Node blockchain lokal Hardhat aktif di latar belakang

### 2. Jalankan Blockchain Lokal (di root proyek)
Buka terminal di root repositori (`d:\blockchain-donasi-escrow`):
```bash
# Terminal 1: Nyalakan blockchain lokal
npm run node

# Terminal 2: Deploy smart contract & siapkan akun awal
npm run deploy:local
```
Kontrak akan terdeploy di alamat `0x5FbDB2315678afecb367f032d93F642f64180aa3` pada Chain ID `31337`.

### 3. Jalankan Frontend
Buka terminal baru di folder `frontend/`:
```bash
cd frontend
npm install
npm run dev
```
Aplikasi akan aktif di alamat `http://localhost:3000`.

### 4. Menghubungkan Dompet ke Node Lokal
1. Buka MetaMask, pilih menu jaringan lalu pilih **Tambah Jaringan Secara Manual**:
   - Nama Jaringan: `Hardhat Localhost`
   - URL RPC: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Simbol Mata Uang: `ETH`
2. Impor akun pengujian bawaan Hardhat (misal akun Organizer, Verifier, atau Donatur) menggunakan private key dummy dari terminal `npm run node`.
3. Buka `http://localhost:3000` dan klik **Hubungkan Dompet**.
