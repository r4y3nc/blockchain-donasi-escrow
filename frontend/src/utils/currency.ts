import { formatEther } from "ethers";

// Standar kurs konversi simulasi: 1 ETH = Rp 50.000.000
export const ETH_TO_IDR_RATE = 50_000_000;

/**
 * Format angka ke mata uang Rupiah Indonesia (contoh: Rp 50.000.000)
 */
export function formatRupiah(amountInIdr: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountInIdr);
}

/**
 * Mengonversi nilai ETH (string, number, atau bigint wei) ke Rupiah
 */
export function ethToIdr(ethAmount: number | bigint | string): number {
  let ethNum = 0;
  if (typeof ethAmount === "bigint") {
    ethNum = parseFloat(formatEther(ethAmount));
  } else if (typeof ethAmount === "string") {
    ethNum = parseFloat(ethAmount) || 0;
  } else {
    ethNum = ethAmount || 0;
  }
  return Math.round(ethNum * ETH_TO_IDR_RATE);
}

/**
 * Format nilai ETH langsung ke tampilan Rupiah (contoh: 1 ETH -> Rp 50.000.000)
 */
export function formatEthToRupiah(ethAmount: number | bigint | string): string {
  const idr = ethToIdr(ethAmount);
  return formatRupiah(idr);
}

/**
 * Mengonversi nilai Rupiah kembali ke nominal ETH (string untuk transaksi smart contract)
 */
export function idrToEth(idrAmount: number): string {
  if (idrAmount <= 0) return "0";
  const eth = idrAmount / ETH_TO_IDR_RATE;
  // Batasi ke 6 desimal agar presisi di blockchain
  return eth.toFixed(6).replace(/\.?0+$/, "");
}

/**
 * Parse string Rupiah (misal "50.000" atau "50000") menjadi angka
 */
export function parseRupiahInput(value: string): number {
  const cleanStr = value.replace(/[^0-9]/g, "");
  return parseInt(cleanStr, 10) || 0;
}
