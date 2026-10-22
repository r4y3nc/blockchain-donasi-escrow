// Menyusun deployment/Deployment_Record.md dari deployment-record.json dan demo-record.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const dep = JSON.parse(readFileSync("deployment/deployment-record.json", "utf8"));
const demo = existsSync("deployment/demo-record.json")
  ? JSON.parse(readFileSync("deployment/demo-record.json", "utf8"))
  : null;

const baris = [];
baris.push("# Deployment Record", "");
baris.push("Tabel 1 Informasi deployment", "");
baris.push("| Item | Nilai |", "|---|---|");
baris.push(`| Waktu | ${dep.waktu} |`);
baris.push(`| Jaringan | ${dep.jaringan} |`);
baris.push(`| Chain ID | ${dep.chainId} |`);
baris.push(`| Kontrak | ${dep.kontrak} |`);
baris.push(`| Alamat kontrak | ${dep.alamatKontrak} |`);
baris.push(`| Transaksi deployment | ${dep.transaksiDeployment.hash} |`);
baris.push(`| Blok | ${dep.transaksiDeployment.blok} |`);
baris.push(`| Gas terpakai | ${dep.transaksiDeployment.gasUsed} |`, "");
baris.push("Tabel 2 Akun uji tanpa private key", "");
baris.push("| Peran | Alamat |", "|---|---|");
for (const [k, v] of Object.entries(dep.akunUji)) baris.push(`| ${k} | ${v} |`);
baris.push("", "Tabel 3 Penyiapan peran", "");
baris.push("| Langkah | Hash transaksi | Blok |", "|---|---|---|");
for (const s of dep.penyiapanPeran) baris.push(`| ${s.langkah} | ${s.hash} | ${s.blok} |`);
if (demo) {
  baris.push("", "Tabel 4 Transaksi alur end-to-end", "");
  baris.push("| No | Langkah | Hash transaksi | Blok | Gas | Event |", "|---|---|---|---|---|---|");
  for (const t of demo.transaksi) baris.push(`| ${t.no} | ${t.langkah} | ${t.hash} | ${t.blok} | ${t.gas} | ${t.event.join(", ")} |`);
  baris.push("", "Tabel 5 State yang diverifikasi", "");
  baris.push("| Item | Nilai |", "|---|---|");
  for (const [k, v] of Object.entries(demo.keadaan)) baris.push(`| ${k} | ${v} |`);
}
baris.push("", "Langkah reproduksi", "");
baris.push("1. Terminal 1: npm run node", "2. Terminal 2: npm run deploy:local", "3. Terminal 2: npm run demo:local", "4. Terminal 2: npm run record");
writeFileSync("deployment/Deployment_Record.md", baris.join("\n") + "\n");
console.log("Tersimpan: deployment/Deployment_Record.md");
