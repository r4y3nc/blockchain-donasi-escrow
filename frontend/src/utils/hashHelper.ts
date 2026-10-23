import { keccak256 } from "ethers";

/**
 * Membaca berkas dokumen fisik (PDF/Gambar/Nota) dan menghitung
 * cryptographic hash Keccak-256 (32 byte) secara off-chain di browser.
 */
export async function calculateFileKeccak256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return keccak256(bytes);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
