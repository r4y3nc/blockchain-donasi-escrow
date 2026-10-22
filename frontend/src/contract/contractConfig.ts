import { Contract, ContractRunner, Interface } from "ethers";
import contractArtifact from "./DonationEscrow.json";

export const ESCROW_ADDRESS = contractArtifact.address;
export const EXPECTED_CHAIN_ID = BigInt(contractArtifact.chainId);
export const ESCROW_ABI = contractArtifact.abi;

export function getEscrowContract(runner: ContractRunner): Contract {
  return new Contract(ESCROW_ADDRESS, ESCROW_ABI, runner);
}

const contractInterface = new Interface(ESCROW_ABI);

/**
 * Menerjemahkan custom error dari smart contract ke pesan bahasa Indonesia yang mudah dipahami.
 */
export function parseContractError(error: any): string {
  if (!error) return "Terjadi kesalahan yang tidak diketahui.";

  // Cek apakah error dibatalkan oleh pengguna di MetaMask
  if (error.code === 4001 || error.code === "ACTION_REJECTED" || error.message?.includes("user rejected")) {
    return "Transaksi dibatalkan oleh pengguna di dompet.";
  }

  // Cek jika saldo tidak cukup
  if (error.code === "INSUFFICIENT_FUNDS" || error.message?.includes("insufficient funds")) {
    return "Saldo dompet tidak mencukupi untuk nominal donasi dan gas fee.";
  }

  // Cek custom error di data revert
  const data = error.data || error.error?.data || error.info?.error?.data;
  if (data && typeof data === "string") {
    try {
      const parsed = contractInterface.parseError(data);
      if (parsed) {
        return translateCustomError(parsed.name);
      }
    } catch {
      // Abaikan jika gagal decode data
    }
  }

  // Cek teks pesan revert
  const msg = String(error.reason || error.message || "");
  for (const errName of [
    "NotRegulator",
    "NotOrganizer",
    "NotVerifier",
    "NotExecutor",
    "CampaignNotFound",
    "InvalidParams",
    "InvalidMilestoneCount",
    "InvalidMilestoneShares",
    "InvalidMilestone",
    "OpCostTooHigh",
    "RoleConflict",
    "VerifierNotApproved",
    "WrongState",
    "FundingClosed",
    "FundingStillOpen",
    "ZeroAmount",
    "ZeroHash",
    "PreviousMilestoneNotReleased",
    "ChallengeWindowOpen",
    "VerificationWindowNotElapsed",
    "DisputeThresholdNotMet",
    "DisputeAlreadyUsed",
    "AlreadyRefunded",
    "NothingToRefund",
    "NothingToWithdraw",
    "ContractPaused",
    "TransferFailed",
  ]) {
    if (msg.includes(errName)) {
      return translateCustomError(errName);
    }
  }

  return msg.length > 150 ? msg.slice(0, 150) + "..." : msg;
}

function translateCustomError(name: string): string {
  switch (name) {
    case "NotRegulator":
      return "Aksi ditolak: Hanya akun Regulator yang berwenang.";
    case "NotOrganizer":
      return "Aksi ditolak: Hanya penyelenggara resmi yang berwenang.";
    case "NotVerifier":
      return "Aksi ditolak: Hanya verifikator independen yang berwenang.";
    case "NotExecutor":
      return "Aksi ditolak: Hanya pelaksana proyek ini yang berwenang.";
    case "CampaignNotFound":
      return "Kampanye tidak ditemukan di blockchain.";
    case "InvalidParams":
      return "Parameter yang dimasukkan tidak valid atau tenggat waktu melebihi 365 hari.";
    case "RoleConflict":
      return "Konflik peran: Verifikator dilarang merangkap sebagai penyelenggara atau pelaksana.";
    case "VerifierNotApproved":
      return "Verifikator belum disetujui oleh Regulator.";
    case "WrongState":
      return "Status kampanye atau milestone saat ini tidak mengizinkan aksi tersebut.";
    case "FundingClosed":
      return "Masa penggalangan donasi telah berakhir.";
    case "FundingStillOpen":
      return "Masa penggalangan dana masih berlangsung dan target belum tercapai.";
    case "ZeroAmount":
      return "Nominal donasi harus lebih dari 0 ETH.";
    case "ZeroHash":
      return "Hash dokumen bukti atau keputusan tidak boleh kosong.";
    case "PreviousMilestoneNotReleased":
      return "Milestone sebelumnya belum dicairkan.";
    case "ChallengeWindowOpen":
      return "Masa sanggahan (challenge window) masih berjalan, dana belum dapat dicairkan.";
    case "VerificationWindowNotElapsed":
      return "Jendela waktu verifikasi belum terlewati, belum dapat dieskalasi.";
    case "DisputeThresholdNotMet":
      return "Total donasi Anda belum mencapai ambang 5% untuk membuka sengketa.";
    case "DisputeAlreadyUsed":
      return "Anda sudah pernah menggunakan hak membuka sengketa untuk kampanye ini.";
    case "AlreadyRefunded":
      return "Pengembalian dana (refund) sudah pernah Anda klaim sebelumnya.";
    case "NothingToRefund":
      return "Tidak ada saldo donasi yang dapat dikembalikan pada akun ini.";
    case "NothingToWithdraw":
      return "Tidak ada saldo klaim yang tersedia untuk ditarik.";
    case "ContractPaused":
      return "Kontrak sedang dibekukan sementara oleh Regulator (kondisi darurat).";
    case "TransferFailed":
      return "Pengiriman ETH gagal dilakukan oleh jaringan.";
    default:
      return `Panggilan kontrak gagal dengan galat: ${name}`;
  }
}
