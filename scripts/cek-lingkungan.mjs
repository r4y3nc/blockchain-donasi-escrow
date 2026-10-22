// Cek lingkungan: dijalankan dengan `npm run cek`.
// Hanya membaca informasi mesin lokal. Tidak mengirim data ke mana pun.
import os from "node:os";
import fs from "node:fs";

const hasil = [];
const catat = (nama, nilai, status = "info") => hasil.push({ nama, nilai, status });

// 1. Node.js
const major = Number(process.versions.node.split(".")[0]);
catat("Node.js", process.version, major >= 22 ? "ok" : "gagal");

// 2. Platform
catat("Platform", `${process.platform} ${process.arch}`, process.arch === "x64" ? "ok" : "periksa");

// 3. CPU dan AVX (hanya Linux)
const cpus = os.cpus();
catat("CPU", `${cpus[0]?.model ?? "tidak diketahui"} (${cpus.length} inti)`);
if (process.platform === "linux") {
  try {
    const info = fs.readFileSync("/proc/cpuinfo", "utf8");
    const flags = (info.match(/^flags\s*:\s*(.*)$/m) ?? [, ""])[1].split(/\s+/);
    catat("Instruksi AVX", flags.includes("avx") ? "ada" : "tidak ada", "info");
    catat("Instruksi AVX2", flags.includes("avx2") ? "ada" : "tidak ada", "info");
  } catch {
    catat("Instruksi AVX", "tidak dapat dibaca", "periksa");
  }
}

// 4. Memori
const gb = (b) => (b / 1024 ** 3).toFixed(1);
catat("Memori total / bebas", `${gb(os.totalmem())} GB / ${gb(os.freemem())} GB`);

// 5. Mesin simulasi jaringan (EDR) dapat dimuat
try {
  const edr = await import("@nomicfoundation/edr");
  catat("Modul EDR (simulasi jaringan)", `termuat (${Object.keys(edr).length} ekspor)`, "ok");
} catch (e) {
  catat("Modul EDR (simulasi jaringan)", `GAGAL: ${String(e.message).split("\n")[0]}`, "gagal");
}

// 6. Akhir baris berkas kontrak. CRLF mengubah bytecode sehingga hash deployment berbeda dari record.
try {
  const dirs = ["contracts", "contracts/mocks"];
  const crlf = dirs
    .flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d).map((f) => `${d}/${f}`) : []))
    .filter((f) => f.endsWith(".sol"))
    .filter((f) => fs.readFileSync(f, "utf8").includes("\r\n"));
  catat(
    "Akhir baris kontrak",
    crlf.length ? `CRLF pada ${crlf.join(", ")}. Hash deployment akan berbeda dari record` : "LF",
    crlf.length ? "periksa" : "ok",
  );
} catch {
  catat("Akhir baris kontrak", "tidak dapat diperiksa", "periksa");
}

const lebar = Math.max(...hasil.map((h) => h.nama.length));
for (const h of hasil) {
  console.log(`${h.status.toUpperCase().padEnd(7)} ${h.nama.padEnd(lebar)}  ${h.nilai}`);
}
const gagal = hasil.filter((h) => h.status === "gagal");
console.log(gagal.length ? `\n${gagal.length} pemeriksaan GAGAL. Kirim keluaran ini ke Claude.` : "\nTidak ada pemeriksaan yang gagal. Lanjut: npm run compile, lalu npm test.");
process.exit(gagal.length ? 1 : 0);
