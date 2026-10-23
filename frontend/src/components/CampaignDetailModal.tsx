import React, { useState } from "react";
import { formatEther } from "ethers";
import {
  Campaign,
  CampaignStatus,
  MilestoneStatus,
  CAMPAIGN_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
} from "../types/escrow";
import { useWeb3 } from "../context/Web3Context";
import { getCampaignMetadata, DonorPrayer } from "../types/campaignMetadata";
import { formatRupiah, ethToIdr } from "../utils/currency";
import { calculateFileKeccak256, formatFileSize } from "../utils/hashHelper";

interface CampaignDetailModalProps {
  campaign: Campaign;
  userContribution: { amount: bigint; refunded: boolean; disputeUsed: boolean };
  prayers: DonorPrayer[];
  onClose: () => void;
  onOpenDonate: (campaign: Campaign) => void;
  onFinalizeFunding: (campaignId: number) => Promise<boolean>;
  onSubmitEvidence: (campaignId: number, milestoneIndex: number, evidenceHash: string) => Promise<boolean>;
  onApproveMilestone: (campaignId: number, milestoneIndex: number) => Promise<boolean>;
  onRejectMilestone: (campaignId: number, milestoneIndex: number, reasonCode: number) => Promise<boolean>;
  onEscalate: (campaignId: number, milestoneIndex: number) => Promise<boolean>;
  onRelease: (campaignId: number, milestoneIndex: number) => Promise<boolean>;
  onRefund: (campaignId: number) => Promise<boolean>;
  onOpenDispute: (campaignId: number) => Promise<boolean>;
}

export const CampaignDetailModal: React.FC<CampaignDetailModalProps> = ({
  campaign,
  userContribution,
  prayers,
  onClose,
  onOpenDonate,
  onFinalizeFunding,
  onSubmitEvidence,
  onApproveMilestone,
  onRejectMilestone,
  onEscalate,
  onRelease,
  onRefund,
  onOpenDispute,
}) => {
  const { account, userRole } = useWeb3();
  const [activeTab, setActiveTab] = useState<"story" | "escrow" | "prayers">("story");
  const [evidenceInput, setEvidenceInput] = useState<string>("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [rejectReasonCode, setRejectReasonCode] = useState<number>(1);
  const [activeActionMilestone, setActiveActionMilestone] = useState<number | null>(null);

  const metadata = getCampaignMetadata(campaign.id);

  const targetEth = parseFloat(formatEther(campaign.fundingTarget));
  const raisedEth = parseFloat(formatEther(campaign.totalRaised));
  const releasedGrossEth = parseFloat(formatEther(campaign.releasedGross));
  const lockedInEscrowEth = Math.max(0, raisedEth - releasedGrossEth);
  const userContribEth = userContribution ? parseFloat(formatEther(userContribution.amount)) : 0;
  const percent = targetEth > 0 ? Math.min(100, Math.round((raisedEth / targetEth) * 100)) : 0;

  // Konversi Rupiah
  const targetIdr = ethToIdr(campaign.fundingTarget);
  const raisedIdr = ethToIdr(campaign.totalRaised);
  const lockedInEscrowIdr = ethToIdr(lockedInEscrowEth);
  const releasedGrossIdr = ethToIdr(releasedGrossEth);
  const userContribIdr = ethToIdr(userContribEth);

  const statusInfo = CAMPAIGN_STATUS_LABELS[campaign.status];
  const isExpired = Date.now() > Number(campaign.fundingDeadline) * 1000;
  const targetReached = campaign.totalRaised >= campaign.fundingTarget;

  const isOrganizer = account && account.toLowerCase() === campaign.organizer.toLowerCase();
  const isVerifier = account && account.toLowerCase() === campaign.verifier.toLowerCase();
  const isExecutor = account && account.toLowerCase() === campaign.executor.toLowerCase();

  const meetsDisputeThreshold =
    userContribution &&
    campaign.totalRaised > 0n &&
    userContribution.amount * 10000n >= campaign.totalRaised * 500n;

  const campaignPrayers = prayers.filter((p) => p.campaignId === campaign.id);

  const handleEvidenceSubmit = async (mIndex: number) => {
    if (!evidenceInput.trim()) return;
    const ok = await onSubmitEvidence(campaign.id, mIndex, evidenceInput.trim());
    if (ok) {
      setEvidenceInput("");
      setFileInfo(null);
      setActiveActionMilestone(null);
    }
  };

  const handleRejectSubmit = async (mIndex: number) => {
    const ok = await onRejectMilestone(campaign.id, mIndex, rejectReasonCode);
    if (ok) {
      setActiveActionMilestone(null);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="campaign-detail-title">
      <div className="modal-dialog" style={{ maxWidth: "720px", padding: "0", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Banner Gambar Header */}
        <div style={{ position: "relative", height: "220px", width: "100%", backgroundColor: "var(--bg-surface)", borderTopLeftRadius: "var(--radius-lg)", borderTopRightRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <img
            src={metadata.imageUrl}
            alt={metadata.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <button
            type="button"
            onClick={onClose}
            className="btn-close"
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              backgroundColor: "rgba(0,0,0,0.6)",
              color: "#ffffff",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Tutup modal"
          >
            &times;
          </button>
          <div style={{ position: "absolute", bottom: "1rem", left: "1.25rem", display: "flex", gap: "0.5rem" }}>
            <span className="badge badge-funding" style={{ backgroundColor: "rgba(2, 132, 199, 0.9)", color: "#fff", backdropFilter: "blur(4px)" }}>
              {metadata.category}
            </span>
            <span className={`badge ${statusInfo.colorClass}`} style={{ backdropFilter: "blur(4px)" }}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Isi Modal */}
        <div style={{ padding: "1.5rem" }}>
          <h2 id="campaign-detail-title" style={{ fontSize: "1.35rem", fontWeight: 800, lineHeight: 1.3, marginBottom: "0.5rem" }}>
            {metadata.title}
          </h2>

          {/* Penggalang Dana Terverifikasi */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem", fontSize: "0.88rem", color: "var(--text-muted)" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "var(--color-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem" }}>
              {metadata.organizerName.slice(0, 1)}
            </div>
            <strong>{metadata.organizerName}</strong>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style={{ fontSize: "0.75rem", color: "var(--color-teal)", fontWeight: 700 }}>Terverifikasi Regulator</span>
          </div>

          {/* Progress Donasi dalam Rupiah */}
          <div style={{ backgroundColor: "var(--bg-surface)", padding: "1.25rem", borderRadius: "var(--radius-md)", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
              <div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", display: "block" }}>Terkumpul dari Para Donatur</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--color-primary)" }}>{formatRupiah(raisedIdr)}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", display: "block" }}>({raisedEth.toFixed(3)} ETH)</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", display: "block" }}>Target Pendanaan</span>
                <span style={{ fontWeight: 700 }}>{formatRupiah(targetIdr)}</span>
                <span style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 700, display: "block" }}>{percent}%</span>
              </div>
            </div>

            <div className="progress-bar-bg" style={{ height: "10px" }}>
              <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
            </div>

            {/* Tombol Donasi Utama / Peringatan Regulator */}
            {campaign.status === CampaignStatus.Funding && !isExpired && (
              userRole.isRegulator ? (
                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.85rem 1rem",
                    backgroundColor: "rgba(126, 34, 206, 0.08)",
                    border: "1px solid #d8b4fe",
                    borderRadius: "var(--radius-sm)",
                    color: "#6b21a8",
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                    lineHeight: 1.45,
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>⚖️</span>
                  <div>
                    <strong style={{ display: "block", marginBottom: "0.15rem" }}>Pemberitahuan Tata Kelola (Regulator):</strong>
                    <span>Akun Regulator dilarang berdonasi demi menjaga netralitas dan independensi pengawasan sengketa.</span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDonate(campaign);
                  }}
                  className="btn-primary"
                  style={{ width: "100%", marginTop: "0.5rem", fontSize: "1.05rem" }}
                >
                  Donasi Sekarang
                </button>
              )
            )}

            {(targetReached || isExpired) && campaign.status === CampaignStatus.Funding && (
              <button
                type="button"
                onClick={() => onFinalizeFunding(campaign.id)}
                className="btn-secondary"
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                Finalisasi Status Penggalangan
              </button>
            )}
          </div>

          {/* Tab Internal Detail */}
          <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-subtle)", marginBottom: "1.25rem" }}>
            <button
              type="button"
              onClick={() => setActiveTab("story")}
              className={`tab-btn ${activeTab === "story" ? "active" : ""}`}
              style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
            >
              Cerita Penggalangan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("escrow")}
              className={`tab-btn ${activeTab === "escrow" ? "active" : ""}`}
              style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
            >
              Transparansi Escrow ({campaign.milestones.length} Tahap)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("prayers")}
              className={`tab-btn ${activeTab === "prayers" ? "active" : ""}`}
              style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
            >
              Doa Donatur ({campaignPrayers.length})
            </button>
          </div>

          {/* TAB 1: CERITA */}
          {activeTab === "story" && (
            <div>
              <p style={{ color: "var(--text-main)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "1.25rem" }}>
                {metadata.story}
              </p>

              <h4 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.6rem" }}>
                Rencana Penggunaan Alokasi Dana:
              </h4>
              <ul style={{ paddingLeft: "1.25rem", color: "var(--text-muted)", fontSize: "0.9rem", display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.5rem" }}>
                {metadata.targetUse.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>

              <div style={{ backgroundColor: "var(--bg-surface)", padding: "1rem", borderRadius: "var(--radius-md)", fontSize: "0.85rem" }}>
                <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: "0.3rem" }}>
                  Informasi Akuntabilitas Blockchain:
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ color: "var(--text-dim)" }}>Alamat Smart Contract Escrow:</span>
                  <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>0x5FbDB2315678afecb367f032d93F642f64180aa3</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ color: "var(--text-dim)" }}>Penyelenggara Terdaftar:</span>
                  <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{campaign.organizer.slice(0, 10)}...{campaign.organizer.slice(-6)} {isOrganizer && "(Akun Anda)"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-dim)" }}>Verifikator Independen:</span>
                  <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{campaign.verifier.slice(0, 10)}...{campaign.verifier.slice(-6)} {isVerifier && "(Akun Anda)"}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSPARANSI ESCROW */}
          {activeTab === "escrow" && (
            <div>
              {/* Tracker Akuntabilitas Dana dalam Rupiah */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", backgroundColor: "var(--bg-surface)", padding: "1rem", borderRadius: "var(--radius-md)", marginBottom: "1.25rem", textAlign: "center" }}>
                <div>
                  <div style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>Total Terkumpul</div>
                  <div style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "0.95rem" }}>{formatRupiah(raisedIdr)}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>Terkunci di Escrow</div>
                  <div style={{ fontWeight: 800, color: "var(--color-amber)", fontSize: "0.95rem" }}>{formatRupiah(lockedInEscrowIdr)}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>Dicairkan ke Lapangan</div>
                  <div style={{ fontWeight: 800, color: "var(--color-emerald)", fontSize: "0.95rem" }}>{formatRupiah(releasedGrossIdr)}</div>
                </div>
              </div>

              {/* Hak Donatur Jika Ada */}
              {userContribIdr > 0 && (
                <div style={{ backgroundColor: "rgba(2, 132, 199, 0.08)", border: "1px solid rgba(2, 132, 199, 0.25)", borderRadius: "var(--radius-md)", padding: "0.85rem 1rem", marginBottom: "1.25rem", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Donasi Anda: </span>
                      <strong style={{ color: "var(--color-primary)" }}>{formatRupiah(userContribIdr)}</strong>
                    </div>
                    {userContribution.refunded ? (
                      <span className="badge" style={{ backgroundColor: "#94a3b8", color: "#fff" }}>Sudah Direfund</span>
                    ) : (campaign.status === CampaignStatus.Failed || campaign.status === CampaignStatus.Cancelled) ? (
                      <button
                        type="button"
                        onClick={() => onRefund(campaign.id)}
                        className="btn-primary"
                        style={{ minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                      >
                        Klaim Pengembalian Dana
                      </button>
                    ) : null}
                  </div>

                  {campaign.status === CampaignStatus.Active && meetsDisputeThreshold && !userContribution.disputeUsed && (
                    <div style={{ marginTop: "0.6rem" }}>
                      <button
                        type="button"
                        onClick={() => onOpenDispute(campaign.id)}
                        className="btn-outline-amber"
                        style={{ width: "100%", fontSize: "0.8rem", minHeight: "34px", padding: "0.3rem" }}
                      >
                        Buka Sengketa Pengawasan (Hak Donatur 5%+)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Status Banner Penggalangan Dana */}
              {campaign.status === CampaignStatus.Funding && (
                <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderLeft: "4px solid var(--color-warning)", borderRadius: "var(--radius-sm)", padding: "0.85rem", marginBottom: "1.25rem" }}>
                  <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: "0.25rem" }}>
                    📢 Program Masih Dalam Masa Penggalangan Dana ({percent}% Terkumpul)
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Tahapan pengerjaan lapangan (unggah bukti oleh Pelaksana dan verifikasi pencairan oleh Lembaga Audit) baru akan dibuka oleh smart contract setelah donasi terkumpul 100% dan status difinalisasi.
                  </div>
                  {targetReached ? (
                    <button
                      type="button"
                      onClick={() => onFinalizeFunding(campaign.id)}
                      className="btn-teal"
                      style={{ marginTop: "0.6rem", minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem", fontWeight: 700 }}
                    >
                      ⚡ Target Tercapai! Klik untuk Finalisasi & Buka Tahap Milestone
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenDonate(campaign)}
                      className="btn-primary"
                      style={{ marginTop: "0.6rem", minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                    >
                      Donasi Sekarang untuk Melengkapi Target
                    </button>
                  )}
                </div>
              )}

              {/* Daftar Tahapan Milestone dalam Rupiah */}
              <div className="milestone-timeline">
                {campaign.milestones.map((m) => {
                  const mLabel = MILESTONE_STATUS_LABELS[m.status];
                  const sharePercent = (m.shareBps / 100).toFixed(1);
                  const mGrossIdr = Math.round((raisedIdr * m.shareBps) / 10000);

                  return (
                    <div key={m.index} className="milestone-item">
                      <div className="milestone-item-header">
                        <div>
                          <span className="milestone-num">Tahap #{m.index + 1}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginLeft: "0.5rem" }}>
                            Porsi {sharePercent}% (Est. {formatRupiah(mGrossIdr)})
                          </span>
                        </div>
                        <span className={`badge ${m.status === MilestoneStatus.Released ? "badge-completed" : m.status === MilestoneStatus.Approved ? "badge-active" : m.status === MilestoneStatus.Submitted ? "badge-funding" : "badge-disputed"}`}>
                          {mLabel.label}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        {mLabel.desc}
                      </div>

                      {m.evidenceHash && m.evidenceHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                        <div className="milestone-hash">
                          Hash Bukti Pekerjaan: {m.evidenceHash}
                        </div>
                      )}

                      {/* Tombol Tindakan Berdasarkan Peran On-Chain */}
                      {campaign.status === CampaignStatus.Active && (
                        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                          {isExecutor && (m.status === MilestoneStatus.Pending || m.status === MilestoneStatus.Rejected) && (
                            <button
                              type="button"
                              onClick={() => setActiveActionMilestone(activeActionMilestone === m.index ? null : m.index)}
                              className="btn-primary"
                              style={{ minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                            >
                              {activeActionMilestone === m.index ? "Tutup Form" : "Unggah Bukti Lapangan"}
                            </button>
                          )}

                          {isVerifier && m.status === MilestoneStatus.Submitted && (
                            <>
                              <button
                                type="button"
                                onClick={() => onApproveMilestone(campaign.id, m.index)}
                                className="btn-primary"
                                style={{ minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                              >
                                Setujui Hasil Kerja
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveActionMilestone(activeActionMilestone === m.index ? null : m.index)}
                                className="btn-outline-danger"
                                style={{ minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                              >
                                Tolak Bukti
                              </button>
                            </>
                          )}

                          {isVerifier && m.status === MilestoneStatus.Pending && (
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                              ⏳ Menunggu Pelaksana mengunggah bukti lapangan sebelum tombol persetujuan aktif.
                            </span>
                          )}

                          {!isVerifier && !isExecutor && (
                            <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                              Pihak Penyetujui: Verifikator Independen ({campaign.verifier.slice(0, 6)}...{campaign.verifier.slice(-4)})
                            </span>
                          )}

                          {m.status === MilestoneStatus.Approved && (
                            <button
                              type="button"
                              onClick={() => onRelease(campaign.id, m.index)}
                              className="btn-secondary"
                              style={{ minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                            >
                              Cairkan Dana (Release)
                            </button>
                          )}

                          {m.status === MilestoneStatus.Submitted && (
                            <button
                              type="button"
                              onClick={() => onEscalate(campaign.id, m.index)}
                              className="btn-outline-amber"
                              style={{ minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                            >
                              Eskalasi ke Regulator
                            </button>
                          )}
                        </div>
                      )}

                      {/* Sub-form Pelaksana */}
                      {activeActionMilestone === m.index && isExecutor && (
                        <div style={{ marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "var(--bg-card)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                          <label className="form-label" style={{ fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                            Pilih Dokumen Bukti Lapangan (Foto / Nota / PDF):
                          </label>
                          <div style={{ border: "1px dashed var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "0.5rem", marginBottom: "0.5rem", backgroundColor: "var(--bg-card-subtle)" }}>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const hash = await calculateFileKeccak256(file);
                                  setEvidenceInput(hash);
                                  setFileInfo({ name: file.name, size: formatFileSize(file.size) });
                                }
                              }}
                              style={{ fontSize: "0.8rem", width: "100%" }}
                            />
                          </div>

                          {fileInfo && (
                            <div style={{ fontSize: "0.78rem", color: "var(--color-teal)", marginBottom: "0.5rem", fontWeight: 600 }}>
                              ✓ Berkas terbaca: {fileInfo.name} ({fileInfo.size})
                            </div>
                          )}

                          <label className="form-label" style={{ fontSize: "0.8rem" }}>
                            Hash Dokumen Bukti Lapangan (bytes32):
                          </label>
                          <input
                            type="text"
                            placeholder="0x..."
                            value={evidenceInput}
                            onChange={(e) => setEvidenceInput(e.target.value)}
                            className="form-input"
                            style={{ fontSize: "0.85rem", minHeight: "38px", marginBottom: "0.5rem", fontFamily: "monospace" }}
                          />
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => handleEvidenceSubmit(m.index)}
                              className="btn-primary"
                              style={{ minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                            >
                              Kirim Bukti ke Kontrak
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEvidenceInput("0x" + "aa".repeat(32));
                                setFileInfo(null);
                              }}
                              className="btn-secondary"
                              style={{ minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                            >
                              Pakai Hash Dummy
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Sub-form Penolakan Verifikator */}
                      {activeActionMilestone === m.index && isVerifier && (
                        <div style={{ marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "var(--bg-card)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                          <label className="form-label" style={{ fontSize: "0.8rem" }}>
                            Kode Alasan Penolakan:
                          </label>
                          <select
                            value={rejectReasonCode}
                            onChange={(e) => setRejectReasonCode(Number(e.target.value))}
                            className="form-input"
                            style={{ fontSize: "0.85rem", minHeight: "38px", marginBottom: "0.5rem" }}
                          >
                            <option value={1}>Kode 1: Bukti laporan fisik belum lengkap</option>
                            <option value={2}>Kode 2: Realisasi tidak sesuai standar proposal</option>
                            <option value={3}>Kode 3: Nota kuitansi tidak valid</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRejectSubmit(m.index)}
                            className="btn-outline-danger"
                            style={{ minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                          >
                            Tolak Milestone Ini
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DOA & DONATUR */}
          {activeTab === "prayers" && (
            <div>
              {campaignPrayers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--text-muted)" }}>
                  Belum ada doa atau pesan kebaikan yang tertulis. Jadilah donatur pertama yang menuliskan pesan!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {campaignPrayers.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        padding: "0.85rem 1rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                        <strong style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>{p.donorName}</strong>
                        <span style={{ fontSize: "0.8rem", color: "var(--color-primary)", fontWeight: 700 }}>{p.amountRupiah}</span>
                      </div>
                      <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
                        "{p.prayer}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Mobile Donate Button */}
        {campaign.status === CampaignStatus.Funding && !isExpired && !userRole.isRegulator && (
          <div className="sticky-mobile-bar">
            <div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", display: "block" }}>Terkumpul</span>
              <strong style={{ color: "var(--color-primary)" }}>{formatRupiah(raisedIdr)}</strong>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDonate(campaign);
              }}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              Donasi Sekarang
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
