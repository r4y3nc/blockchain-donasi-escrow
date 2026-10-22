export enum CampaignStatus {
  Funding = 0,
  Active = 1,
  Disputed = 2,
  Failed = 3,
  Cancelled = 4,
  Completed = 5,
}

export enum MilestoneStatus {
  Pending = 0,
  Submitted = 1,
  Approved = 2,
  Rejected = 3,
  Escalated = 4,
  Released = 5,
}

export interface Milestone {
  index: number;
  status: MilestoneStatus;
  shareBps: number;
  submittedAt: bigint;
  approvedAt: bigint;
  evidenceHash: string;
}

export interface CampaignWindows {
  verification: bigint;
  challenge: bigint;
}

export interface Campaign {
  id: number;
  organizer: string;
  status: CampaignStatus;
  opCostBps: number;
  milestoneCount: number;
  fundingDeadline: bigint;
  verifier: string;
  executor: string;
  metadataHash: string;
  fundingTarget: bigint;
  totalRaised: bigint;
  releasedGross: bigint;
  milestones: Milestone[];
  windows?: CampaignWindows;
}

export interface UserRoleInfo {
  isRegulator: boolean;
  isOrganizer: boolean;
  isVerifier: boolean;
  isExecutor: boolean;
  isDonor: boolean;
  claimableBalance: bigint;
}

export interface TransactionState {
  status: "idle" | "awaiting_wallet" | "broadcasting" | "confirmed" | "failed";
  hash?: string;
  actionTitle?: string;
  errorMessage?: string;
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, { label: string; colorClass: string }> = {
  [CampaignStatus.Funding]: { label: "Penggalangan Dana", colorClass: "badge-funding" },
  [CampaignStatus.Active]: { label: "Milestone Aktif", colorClass: "badge-active" },
  [CampaignStatus.Disputed]: { label: "Dalam Sengketa", colorClass: "badge-disputed" },
  [CampaignStatus.Failed]: { label: "Gagal (Dapat Refund)", colorClass: "badge-failed" },
  [CampaignStatus.Cancelled]: { label: "Dibatalkan (Refund Pro-Rata)", colorClass: "badge-cancelled" },
  [CampaignStatus.Completed]: { label: "Selesai", colorClass: "badge-completed" },
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, { label: string; desc: string }> = {
  [MilestoneStatus.Pending]: { label: "Menunggu", desc: "Pengerjaan fisik oleh pelaksana" },
  [MilestoneStatus.Submitted]: { label: "Bukti Diunggah", desc: "Menunggu telaah verifikator" },
  [MilestoneStatus.Approved]: { label: "Disetujui", desc: "Masa sanggahan sedang berjalan" },
  [MilestoneStatus.Rejected]: { label: "Ditolak", desc: "Perlu perbaikan bukti dari pelaksana" },
  [MilestoneStatus.Escalated]: { label: "Dieskalasi", desc: "Verifikator melewati batas waktu" },
  [MilestoneStatus.Released]: { label: "Dana Dicairkan", desc: "Dana siap ditarik oleh pelaksana dan organizer" },
};
