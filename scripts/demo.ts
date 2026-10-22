import { readFileSync, writeFileSync } from "node:fs";
import hre from "hardhat";

// Alur end-to-end pada kontrak yang sudah dideploy oleh scripts/deploy.ts.
// Mencatat hash transaksi, event, dan perubahan state sebagai bukti.
// Catatan: skrip memajukan waktu node 2 hari untuk melewati challenge window.
const { ethers } = await hre.network.create("localhost");

const rec = JSON.parse(readFileSync("deployment/deployment-record.json", "utf8"));
const [regulator, organizer, verifier, , executor, donorA, donorB, stranger] = await ethers.getSigners();
const escrow = await ethers.getContractAt("DonationEscrow", rec.alamatKontrak);
const ETH = (n: string) => ethers.parseEther(n);
const hashOf = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

type Langkah = { no: number; langkah: string; hash: string; blok: number; gas: string; event: string[]; catatan?: string };
const log: Langkah[] = [];

async function kirim(langkah: string, tx: Promise<any>, catatan?: string) {
  const r = await (await tx).wait();
  const event = r.logs.map((l: any) => escrow.interface.parseLog(l)?.name).filter(Boolean) as string[];
  log.push({ no: log.length + 1, langkah, hash: r.hash, blok: r.blockNumber, gas: r.gasUsed.toString(), event, catatan });
  console.log(`${log.length}. ${langkah} ${r.hash}`);
}

const saldo = async () => (await ethers.provider.getBalance(rec.alamatKontrak)).toString();
const tenggat = (await ethers.provider.getBlock("latest"))!.timestamp + 30 * 24 * 3600;

await kirim(
  "createCampaign",
  escrow.connect(organizer).createCampaign(hashOf("dokumen-kampanye-demo"), ETH("1"), tenggat, 500, verifier.address, executor.address, [3000, 3000, 4000]),
);
const id = await escrow.campaignCount();
await kirim("donate donorA 0.6", escrow.connect(donorA).donate(id, { value: ETH("0.6") }));
await kirim("donate donorB 0.4", escrow.connect(donorB).donate(id, { value: ETH("0.4") }));
const saldoSetelahDonasi = await saldo();
await kirim("finalizeFunding", escrow.finalizeFunding(id));
const statusAktif = (await escrow.getCampaign(id)).status;

// Kondisi tidak valid: pemanggil tanpa wewenang ditolak, tanpa perubahan state.
let galat = "tidak ada galat";
try {
  await escrow.connect(stranger).setOrganizerApproval(stranger.address, true);
} catch (e: any) {
  galat = e?.message?.match(/custom error '([^']+)'/)?.[1] ?? String(e?.message ?? e).slice(0, 120);
}
console.log("Panggilan tidak sah ditolak dengan:", galat);

await kirim("submitEvidence milestone 0", escrow.connect(executor).submitEvidence(id, 0, hashOf("bukti-milestone-0")));
await kirim("approveMilestone milestone 0", escrow.connect(verifier).approveMilestone(id, 0));
await ethers.provider.send("evm_increaseTime", [2 * 24 * 3600 + 1]);
await ethers.provider.send("evm_mine", []);
const milestone0 = await escrow.getMilestone(id, 0);
await kirim("release milestone 0", escrow.release(id, 0));
const claimOrganizer = (await escrow.claimable(organizer.address)).toString();
const claimPelaksana = (await escrow.claimable(executor.address)).toString();
await kirim("withdraw pelaksana", escrow.connect(executor).withdraw());

const keadaan = {
  idKampanye: id.toString(),
  saldoKontrakSetelahDonasiWei: saldoSetelahDonasi,
  statusKampanyeSetelahFinalisasi: statusAktif.toString(),
  statusMilestone0SebelumRelease: milestone0.status.toString(),
  claimableOrganizerWei: claimOrganizer,
  claimablePelaksanaWei: claimPelaksana,
  saldoKontrakAkhirWei: await saldo(),
  panggilanTidakSahDitolakDengan: galat,
};

writeFileSync(
  "deployment/demo-record.json",
  JSON.stringify({ waktu: new Date().toISOString(), chainId: rec.chainId, alamatKontrak: rec.alamatKontrak, transaksi: log, keadaan }, null, 2) + "\n",
);
console.log("Tersimpan: deployment/demo-record.json");
