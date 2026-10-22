import { mkdirSync, writeFileSync } from "node:fs";
import hre from "hardhat";

const NAMA_JARINGAN = "localhost";

// Deployment ke node lokal. Jalankan `npm run node` di terminal lain terlebih dahulu.
// Hanya akun uji bawaan node yang dipakai. Tidak ada private key atau seed phrase pada repositori.
const { ethers } = await hre.network.create(NAMA_JARINGAN);

const [regulator, organizer, verifier, verifier2, executor] = await ethers.getSigners();
const net = await ethers.provider.getNetwork();

console.log(`Jaringan: ${NAMA_JARINGAN}, chain ID ${net.chainId}`);

const escrow = await ethers.deployContract("DonationEscrow", [regulator.address]);
const deployTx = escrow.deploymentTransaction()!;
const deployReceipt = (await deployTx.wait())!;
const address = await escrow.getAddress();

// Penyiapan peran awal oleh Regulator.
const setup: { langkah: string; hash: string; blok: number }[] = [];
for (const [langkah, send] of [
  ["setOrganizerApproval organizer", () => escrow.setOrganizerApproval(organizer.address, true)],
  ["setVerifierApproval verifier", () => escrow.setVerifierApproval(verifier.address, true)],
  ["setVerifierApproval verifier2", () => escrow.setVerifierApproval(verifier2.address, true)],
] as const) {
  const r = (await (await send()).wait())!;
  setup.push({ langkah, hash: r.hash, blok: r.blockNumber });
}

const artifact = await hre.artifacts.readArtifact("DonationEscrow");

const record = {
  waktu: new Date().toISOString(),
  jaringan: NAMA_JARINGAN,
  chainId: net.chainId.toString(),
  kontrak: "DonationEscrow",
  alamatKontrak: address,
  transaksiDeployment: { hash: deployReceipt.hash, blok: deployReceipt.blockNumber, gasUsed: deployReceipt.gasUsed.toString() },
  akunUji: {
    regulator: regulator.address,
    organizer: organizer.address,
    verifier: verifier.address,
    verifier2: verifier2.address,
    pelaksana: executor.address,
  },
  penyiapanPeran: setup,
};

mkdirSync("deployment", { recursive: true });
writeFileSync("deployment/deployment-record.json", JSON.stringify(record, null, 2) + "\n");
// Berkas untuk frontend: alamat, chain ID, dan ABI.
writeFileSync(
  "deployment/DonationEscrow.json",
  JSON.stringify({ chainId: record.chainId, address, abi: artifact.abi }, null, 2) + "\n",
);

console.log("Alamat kontrak:", address);
console.log("Hash deployment:", deployReceipt.hash);
console.log("Tersimpan: deployment/deployment-record.json dan deployment/DonationEscrow.json");
