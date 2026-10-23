import React, { useState } from "react";
import { formatEther } from "ethers";
import { Campaign, CampaignStatus, MilestoneStatus } from "../types/escrow";
import { useWeb3 } from "../context/Web3Context";
import { formatRupiah, ethToIdr, idrToEth, parseRupiahInput } from "../utils/currency";
import { calculateFileKeccak256, formatFileSize } from "../utils/hashHelper";
import { getCampaignMetadata } from "../types/campaignMetadata";

interface OperatorSidebarLayoutProps {
  campaigns: Campaign[];
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenDemoGuide: () => void;
  onSelectCampaign: (campaign: Campaign) => void;
  onWithdraw: () => Promise<boolean>;
  onCreateCampaign: (
    metadataHash: string,
    fundingTargetEth: string,
    deadlineEpoch: number,
    opCostBps: number,
    verifier: string,
    executor: string,
    sharesBps: number[]
  ) => Promise<boolean>;
  onSubmitEvidence: (campaignId: number, milestoneIndex: number, evidenceHash: string) => Promise<boolean>;
  onApproveMilestone: (campaignId: number, milestoneIndex: number) => Promise<boolean>;
  onRejectMilestone: (campaignId: number, milestoneIndex: number, reasonCode: number) => Promise<boolean>;
  onSwitchToPublic: () => void;
}

export const OperatorSidebarLayout: React.FC<OperatorSidebarLayoutProps> = ({
  campaigns,
  theme,
  onToggleTheme,
  onOpenDemoGuide,
  onSelectCampaign,
  onWithdraw,
  onCreateCampaign,
  onSubmitEvidence,
  onApproveMilestone,
  onRejectMilestone,
  onSwitchToPublic,
}) => {
  const { account, userRole, balance, disconnectWallet } = useWeb3();

  // Evaluasi apakah akun saat ini adalah Pelaksana Lapangan
  const isCampaignExecutor = campaigns.some(
    (c) => account && c.executor.toLowerCase() === account.toLowerCase()
  );
  const isDemoExecutor =
    account && account.toLowerCase() === "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65".toLowerCase();
  const isExecutor = userRole.isExecutor || isCampaignExecutor || !!isDemoExecutor;

  // Tentukan menu default sesuai role
  const getDefaultMenu = (): string => {
    if (userRole.isVerifier) return "verifier-queue";
    if (isExecutor) return "executor-tasks";
    if (userRole.isOrganizer) return "organizer-campaigns";
    if (userRole.isRegulator) return "regulator-oversight";
    return "claims";
  };

  const [activeMenu, setActiveMenu] = useState<string>(getDefaultMenu);

  // Form buat kampanye baru (Penyelenggara)
  const [targetIdr, setTargetIdr] = useState<number>(50000000);
  const [daysInput, setDaysInput] = useState<number>(30);
  const [opCostPercent, setOpCostPercent] = useState<number>(5);
  const [verifierInput, setVerifierInput] = useState<string>("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  const [executorInput, setExecutorInput] = useState<string>("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65");
  const [sharesInput, setSharesInput] = useState<string>("30, 30, 40");
  const [formError, setFormError] = useState<string | null>(null);

  // State upload bukti pelaksana
  const [evidenceMap, setEvidenceMap] = useState<Record<string, string>>({});
  const [fileInfoMap, setFileInfoMap] = useState<Record<string, { name: string; size: string }>>({});

  // Hitung data ringkasan peran
  const myCampaigns = campaigns.filter(
    (c) => account && c.organizer.toLowerCase() === account.toLowerCase()
  );

  const verifierTasks: { campaign: Campaign; milestone: any }[] = [];
  const executorTasks: { campaign: Campaign; milestone: any }[] = [];
  const escalatedMilestones: { campaign: Campaign; milestone: any }[] = [];

  const pendingFundingForExecutor = campaigns.filter(
    (c) => c.status === CampaignStatus.Funding && (c.executor.toLowerCase() === account?.toLowerCase() || isDemoExecutor)
  );
  const pendingFundingForVerifier = campaigns.filter(
    (c) => c.status === CampaignStatus.Funding && account && c.verifier.toLowerCase() === account.toLowerCase()
  );

  campaigns.forEach((camp) => {
    if (camp.status === CampaignStatus.Active) {
      camp.milestones.forEach((m) => {
        if (
          userRole.isVerifier &&
          account &&
          camp.verifier.toLowerCase() === account.toLowerCase() &&
          m.status === MilestoneStatus.Submitted
        ) {
          verifierTasks.push({ campaign: camp, milestone: m });
        }
        if (
          isExecutor &&
          account &&
          (camp.executor.toLowerCase() === account.toLowerCase() || isDemoExecutor) &&
          (m.status === MilestoneStatus.Pending || m.status === MilestoneStatus.Rejected)
        ) {
          executorTasks.push({ campaign: camp, milestone: m });
        }
        if (m.status === MilestoneStatus.Escalated) {
          escalatedMilestones.push({ campaign: camp, milestone: m });
        }
      });
    }
  });

  // Profil singkat peran
  const getRoleBadge = () => {
    if (userRole.isRegulator) {
      return { title: "Dewan Pengawas", label: "Regulator", className: "role-regulator", icon: "⚖️" };
    }
    if (userRole.isOrganizer) {
      return { title: "Yayasan Peduli", label: "Penyelenggara", className: "role-organizer", icon: "🏛️" };
    }
    if (userRole.isVerifier) {
      return { title: "Lembaga Audit Independen", label: "Verifikator", className: "role-verifier", icon: "🛡️" };
    }
    if (isExecutor) {
      return { title: "Kontraktor Tim Lapangan", label: "Pelaksana", className: "badge-active", icon: "🛠️" };
    }
    return { title: "Donatur Publik", label: "Masyarakat", className: "badge-funding", icon: "👤" };
  };

  const roleInfo = getRoleBadge();
  const shortAddress = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "";
  const claimableEth = userRole ? parseFloat(formatEther(userRole.claimableBalance)) : 0;
  const claimableIdr = ethToIdr(claimableEth);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const shares = sharesInput
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n));

    const sum = shares.reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      setFormError("Total alokasi milestone harus tepat 100%. Contoh: 30, 30, 40");
      return;
    }

    const sharesBps = shares.map((s) => s * 100);
    const deadlineEpoch = Math.floor(Date.now() / 1000) + daysInput * 24 * 3600;
    const opCostBps = Math.round(opCostPercent * 100);
    const targetEthStr = idrToEth(targetIdr);

    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const metadataHash = "0x" + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    const ok = await onCreateCampaign(
      metadataHash,
      targetEthStr,
      deadlineEpoch,
      opCostBps,
      verifierInput.trim(),
      executorInput.trim(),
      sharesBps
    );

    if (ok) {
      setActiveMenu("organizer-campaigns");
    }
  };

  return (
    <div className="operator-layout">
      {/* SIDEBAR OPERASIONAL */}
      <aside className="operator-sidebar">
        {/* Header Sidebar */}
        <div className="sidebar-header">
          <div className="brand-logo-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <div>
              <div className="sidebar-app-name">DonationEscrow</div>
              <div className="sidebar-console-tag">Konsol Pengelola</div>
            </div>
          </div>
        </div>

        {/* Profil Akun & Peran */}
        <div className="sidebar-profile-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <span className={`role-pill ${roleInfo.className}`}>{roleInfo.label}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--color-teal)", fontWeight: 700 }}>On-Chain</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-main)", marginBottom: "0.2rem" }}>
            {roleInfo.title}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.6rem" }}>
            {shortAddress}
          </div>
          <button
            type="button"
            onClick={onOpenDemoGuide}
            className="btn-secondary"
            style={{ width: "100%", minHeight: "32px", fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
          >
            Ganti Akun Demo
          </button>
        </div>

        {/* Navigasi Utama Sidebar */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">NAVIGASI UTAMA</div>

          {/* Menu Khusus Penyelenggara */}
          {userRole.isOrganizer && (
            <>
              <button
                type="button"
                onClick={() => setActiveMenu("organizer-campaigns")}
                className={`sidebar-nav-item ${activeMenu === "organizer-campaigns" ? "active" : ""}`}
              >
                <span className="nav-icon">📋</span>
                <span className="nav-label">Program Yayasan</span>
                <span className="nav-badge">{myCampaigns.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMenu("organizer-create")}
                className={`sidebar-nav-item ${activeMenu === "organizer-create" ? "active" : ""}`}
              >
                <span className="nav-icon">➕</span>
                <span className="nav-label">Buka Donasi Baru</span>
              </button>
            </>
          )}

          {/* Menu Khusus Verifikator */}
          {userRole.isVerifier && (
            <>
              <button
                type="button"
                onClick={() => setActiveMenu("verifier-queue")}
                className={`sidebar-nav-item ${activeMenu === "verifier-queue" ? "active" : ""}`}
              >
                <span className="nav-icon">🛡️</span>
                <span className="nav-label">Antrean Verifikasi</span>
                {verifierTasks.length > 0 && (
                  <span className="nav-badge alert">{verifierTasks.length}</span>
                )}
              </button>
            </>
          )}

          {/* Menu Khusus Pelaksana Lapangan */}
          {isExecutor && (
            <>
              <button
                type="button"
                onClick={() => setActiveMenu("executor-tasks")}
                className={`sidebar-nav-item ${activeMenu === "executor-tasks" ? "active" : ""}`}
              >
                <span className="nav-icon">🛠️</span>
                <span className="nav-label">Tugas Unggah Bukti</span>
                {executorTasks.length > 0 && (
                  <span className="nav-badge alert">{executorTasks.length}</span>
                )}
              </button>
            </>
          )}

          {/* Menu Khusus Regulator */}
          {userRole.isRegulator && (
            <>
              <button
                type="button"
                onClick={() => setActiveMenu("regulator-oversight")}
                className={`sidebar-nav-item ${activeMenu === "regulator-oversight" ? "active" : ""}`}
              >
                <span className="nav-icon">⚖️</span>
                <span className="nav-label">Pengawasan & Eskalasi</span>
                {escalatedMilestones.length > 0 && (
                  <span className="nav-badge alert">{escalatedMilestones.length}</span>
                )}
              </button>
            </>
          )}

          {/* Menu Umum Operasional: Saldo Klaim Escrow */}
          <button
            type="button"
            onClick={() => setActiveMenu("claims")}
            className={`sidebar-nav-item ${activeMenu === "claims" ? "active" : ""}`}
          >
            <span className="nav-icon">💰</span>
            <span className="nav-label">Saldo & Klaim Escrow</span>
            {claimableEth > 0 && (
              <span className="nav-badge success">Ada Saldo</span>
            )}
          </button>

          {/* Menu Semua Kampanye dalam Sistem */}
          <button
            type="button"
            onClick={() => setActiveMenu("all-campaigns")}
            className={`sidebar-nav-item ${activeMenu === "all-campaigns" ? "active" : ""}`}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Pantau Semua Kampanye</span>
            <span className="nav-badge">{campaigns.length}</span>
          </button>

          <div className="sidebar-section-label" style={{ marginTop: "1rem" }}>MODE TINJAU</div>
          <button
            type="button"
            onClick={onSwitchToPublic}
            className="sidebar-nav-item"
            title="Lihat tampilan platform dari sudut pandang donatur umum"
          >
            <span className="nav-icon">🌐</span>
            <span className="nav-label">Buka Portal Donatur</span>
          </button>
        </nav>

        {/* Footer Sidebar */}
        <div className="sidebar-footer">
          <div className="sidebar-node-status">
            <span className="node-dot" />
            <span>Hardhat Local (31337)</span>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
            <button
              type="button"
              onClick={onToggleTheme}
              className="btn-secondary"
              style={{ flex: 1, minHeight: "34px", padding: "0.3rem", fontSize: "0.8rem" }}
              title="Ganti tema tampilan"
            >
              {theme === "light" ? "🌙 Gelap" : "☀️ Terang"}
            </button>
            <button
              type="button"
              onClick={disconnectWallet}
              className="btn-secondary"
              style={{ minHeight: "34px", padding: "0.3rem 0.6rem", fontSize: "0.8rem", color: "var(--color-danger)" }}
              title="Keluar dari akun saat ini"
            >
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* WORKSPACE AREA KANAN */}
      <div className="operator-workspace">
        {/* Top Header Workspace */}
        <header className="workspace-topbar">
          <div>
            <div className="workspace-breadcrumb">Konsol Pengelola / {roleInfo.title}</div>
            <h1 className="workspace-page-title">
              {activeMenu === "organizer-campaigns" && "Program Penggalangan Yayasan"}
              {activeMenu === "organizer-create" && "Formulir Pembukaan Program Baru"}
              {activeMenu === "verifier-queue" && "Antrean Penelaahan Bukti Milestone"}
              {activeMenu === "executor-tasks" && "Tugas Lapangan & Unggah Bukti Keccak-256"}
              {activeMenu === "regulator-oversight" && "Panel Pengawasan & Eskalasi Sengketa"}
              {activeMenu === "claims" && "Pencairan Dana Escrow & Hak Tarik"}
              {activeMenu === "all-campaigns" && "Seluruh Kampanye dalam Jaringan"}
            </h1>
          </div>

          <div className="workspace-top-actions">
            <div className="workspace-balance-chip">
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Saldo Dompet:</span>
              <strong style={{ fontSize: "0.9rem" }}>{parseFloat(balance).toFixed(3)} ETH</strong>
            </div>

            {claimableEth > 0 && (
              <button
                type="button"
                onClick={onWithdraw}
                className="btn-teal"
                style={{ minHeight: "36px", padding: "0.3rem 0.9rem", fontSize: "0.85rem", fontWeight: 700 }}
              >
                ⚡ Tarik Saldo ({claimableEth.toFixed(3)} ETH)
              </button>
            )}
          </div>
        </header>

        {/* Isi Halaman Workspace */}
        <main className="workspace-content">
          {/* 1. TAMPILAN ANTREAN VERIFIKATOR */}
          {activeMenu === "verifier-queue" && (
            <div>
              {verifierTasks.length === 0 ? (
                <div className="state-box">
                  <div className="state-icon">🛡️</div>
                  <h3 className="state-title">Antrean Verifikasi Bersih</h3>
                  <p className="state-desc">
                    Saat ini belum ada pengajuan bukti milestone dari pelaksana yang menunggu persetujuan Anda (status: Submitted).
                  </p>
                  {pendingFundingForVerifier.length > 0 && (
                    <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "0.85rem", maxWidth: "560px", textAlign: "left", fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
                      <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: "0.25rem" }}>
                        📢 Status Program yang Anda Awasi:
                      </div>
                      {pendingFundingForVerifier.map((camp) => (
                        <div key={camp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                          <div>
                            <strong>Kampanye #{camp.id}: {getCampaignMetadata(camp.id).title}</strong>
                            <div style={{ fontSize: "0.78rem", color: "var(--color-amber)", marginTop: "0.15rem" }}>
                              Status: Masih Penggalangan Dana ({parseFloat(formatEther(camp.totalRaised)).toFixed(3)} ETH dari target {parseFloat(formatEther(camp.fundingTarget)).toFixed(3)} ETH)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSelectCampaign(camp)}
                            className="btn-secondary"
                            style={{ minHeight: "32px", fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
                          >
                            Buka Rincian
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "0.85rem", maxWidth: "560px", textAlign: "left", fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: "0.25rem" }}>💡 Alur Kerja Verifikasi:</div>
                    1. Pelaksana Lapangan (Executor) mengunggah berkas bukti dan mengirimkan transaksi hash on-chain.<br />
                    2. Milestone akan otomatis masuk ke antrean ini dengan tombol <strong>Setujui Milestone</strong> dan <strong>Tolak Bukti</strong>.<br />
                    3. Setelah disetujui verifikator, challenge window berjalan sebelum dana dicairkan.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ backgroundColor: "var(--bg-card)", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                      Sebagai Verifikator Independen, Anda bertugas meninjau keabsahan bukti lapangan sebelum dana tahap berikutnya dilepaskan dari kontrak escrow.
                    </p>
                  </div>

                  {verifierTasks.map(({ campaign, milestone }) => (
                    <div
                      key={`${campaign.id}-${milestone.index}`}
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderLeft: "4px solid var(--color-teal)",
                        borderRadius: "var(--radius-md)",
                        padding: "1.25rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-main)" }}>
                            Kampanye #{campaign.id}: {getCampaignMetadata(campaign.id).title}
                          </span>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                            Tahap Milestone ke-{milestone.index + 1} (Alokasi: {milestone.shareBps / 100}%)
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectCampaign(campaign)}
                          className="btn-secondary"
                          style={{ minHeight: "32px", fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
                        >
                          Lihat Rincian Kampanye
                        </button>
                      </div>

                      <div style={{ backgroundColor: "var(--bg-card-subtle)", padding: "0.75rem", borderRadius: "var(--radius-sm)", margin: "0.75rem 0", fontFamily: "monospace", fontSize: "0.82rem" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.25rem", fontFamily: "inherit" }}>
                          Hash Bukti Lapangan On-Chain:
                        </div>
                        <div style={{ wordBreak: "break-all", color: "var(--color-primary)" }}>
                          {milestone.evidenceHash}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
                        <button
                          type="button"
                          onClick={() => onApproveMilestone(campaign.id, milestone.index)}
                          className="btn-primary"
                          style={{ minHeight: "38px", padding: "0.35rem 1rem", fontSize: "0.85rem" }}
                        >
                          ✓ Setujui Milestone & Izinkan Pencairan
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectMilestone(campaign.id, milestone.index, 1)}
                          className="btn-danger"
                          style={{ minHeight: "38px", padding: "0.35rem 1rem", fontSize: "0.85rem" }}
                        >
                          ✕ Tolak Bukti (Dokumen Tidak Valid)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. TAMPILAN TUGAS PELAKSANA */}
          {activeMenu === "executor-tasks" && (
            <div>
              {executorTasks.length === 0 ? (
                <div className="state-box">
                  <div className="state-icon">🛠️</div>
                  <h3 className="state-title">Belum Ada Milestone yang Siap Dikerjakan</h3>
                  <p className="state-desc">
                    Tidak ada milestone aktif yang membutuhkan dokumen atau bukti pelaksanaan saat ini.
                  </p>
                  {pendingFundingForExecutor.length > 0 && (
                    <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "0.85rem", maxWidth: "560px", textAlign: "left", fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
                      <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: "0.25rem" }}>
                        📢 Status Program yang Menugaskan Anda:
                      </div>
                      {pendingFundingForExecutor.map((camp) => (
                        <div key={camp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                          <div>
                            <strong>Kampanye #{camp.id}: {getCampaignMetadata(camp.id).title}</strong>
                            <div style={{ fontSize: "0.78rem", color: "var(--color-amber)", marginTop: "0.15rem" }}>
                              Status: Masih Penggalangan Dana ({parseFloat(formatEther(camp.totalRaised)).toFixed(3)} ETH dari target {parseFloat(formatEther(camp.fundingTarget)).toFixed(3)} ETH)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSelectCampaign(camp)}
                            className="btn-secondary"
                            style={{ minHeight: "32px", fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
                          >
                            Buka Rincian
                          </button>
                        </div>
                      ))}
                      <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "0.6rem" }}>
                        ℹ️ Smart contract mewajibkan target donasi tercapai 100% dan difinalisasi sebelum pelaksana dapat mengunggah bukti pengerjaan.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ backgroundColor: "var(--bg-card)", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                      Unggah berkas bukti nyata (nota kuitansi, foto progres, atau PDF laporan). Peramban akan otomatis menghitung <strong>hash Keccak-256</strong> secara lokal untuk dikirim ke blockchain.
                    </p>
                  </div>

                  {executorTasks.map(({ campaign, milestone }) => {
                    const key = `${campaign.id}-${milestone.index}`;
                    return (
                      <div
                        key={key}
                        style={{
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          borderLeft: "4px solid var(--color-warning)",
                          borderRadius: "var(--radius-md)",
                          padding: "1.25rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                          <div>
                            <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-main)" }}>
                              Kampanye #{campaign.id}: {getCampaignMetadata(campaign.id).title}
                            </span>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                              Milestone #{milestone.index + 1} ({milestone.shareBps / 100}%)
                              {milestone.status === MilestoneStatus.Rejected && (
                                <span style={{ color: "var(--color-danger)", marginLeft: "0.5rem", fontWeight: 700 }}>
                                  (Ditolak Verifikator, Mohon Kirim Ulang Bukti)
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSelectCampaign(campaign)}
                            className="btn-secondary"
                            style={{ minHeight: "32px", fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
                          >
                            Detail
                          </button>
                        </div>

                        {/* File Picker & Auto Keccak-256 */}
                        <div style={{ marginTop: "1rem" }}>
                          <label className="form-label" style={{ fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                            Pilih Dokumen Bukti Nyata (Foto / Nota / PDF):
                          </label>
                          <div style={{ border: "1px dashed var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "0.6rem", marginBottom: "0.6rem", backgroundColor: "var(--bg-card-subtle)" }}>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const hash = await calculateFileKeccak256(file);
                                  setEvidenceMap((prev) => ({ ...prev, [key]: hash }));
                                  setFileInfoMap((prev) => ({
                                    ...prev,
                                    [key]: { name: file.name, size: formatFileSize(file.size) },
                                  }));
                                }
                              }}
                              style={{ fontSize: "0.85rem", width: "100%" }}
                            />
                          </div>

                          {fileInfoMap[key] && (
                            <div style={{ fontSize: "0.8rem", color: "var(--color-teal)", marginBottom: "0.6rem", fontWeight: 600 }}>
                              ✓ Berkas terbaca: {fileInfoMap[key].name} ({fileInfoMap[key].size})
                            </div>
                          )}

                          <label className="form-label" style={{ fontSize: "0.8rem" }}>
                            Hash Bukti Keccak-256 (bytes32):
                          </label>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <input
                              type="text"
                              placeholder="0x..."
                              value={evidenceMap[key] || ""}
                              onChange={(e) => setEvidenceMap({ ...evidenceMap, [key]: e.target.value })}
                              className="form-input"
                              style={{ flex: 1, minHeight: "38px", fontSize: "0.85rem", fontFamily: "monospace" }}
                            />
                            <button
                              type="button"
                              onClick={() => onSubmitEvidence(campaign.id, milestone.index, evidenceMap[key] || ("0x" + "22".repeat(32)))}
                              className="btn-primary"
                              style={{ minHeight: "38px", padding: "0.35rem 1rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                            >
                              Kirim Bukti ke Kontrak
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. TAMPILAN PROGRAM YAYASAN (PENYELENGGARA) */}
          {activeMenu === "organizer-campaigns" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  Daftar program penggalangan dana yang dibuat dan dikelola oleh akun yayasan Anda.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveMenu("organizer-create")}
                  className="btn-primary"
                  style={{ minHeight: "36px", padding: "0.3rem 0.9rem", fontSize: "0.85rem" }}
                >
                  + Buat Program Baru
                </button>
              </div>

              {myCampaigns.length === 0 ? (
                <div className="state-box">
                  <div className="state-icon">🏛️</div>
                  <h3 className="state-title">Belum Ada Program</h3>
                  <p className="state-desc">
                    Akun yayasan Anda belum mendaftarkan kampanye donasi ke kontrak escrow.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveMenu("organizer-create")}
                    className="btn-primary"
                  >
                    Buka Penggalangan Pertama
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {myCampaigns.map((camp) => {
                    const meta = getCampaignMetadata(camp.id);
                    const targetEth = parseFloat(formatEther(camp.fundingTarget));
                    const raisedEth = parseFloat(formatEther(camp.totalRaised));
                    const percent = targetEth > 0 ? Math.min(100, Math.round((raisedEth / targetEth) * 100)) : 0;
                    return (
                      <div
                        key={camp.id}
                        style={{
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-md)",
                          padding: "1.25rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "1rem",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: "260px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                            <span className="badge-category">{meta.category}</span>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>ID #{camp.id}</span>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-main)" }}>
                            {meta.title}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                            Terkumpul: <strong>{raisedEth.toFixed(3)} ETH</strong> dari target {targetEth.toFixed(3)} ETH ({percent}%)
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => onSelectCampaign(camp)}
                            className="btn-secondary"
                            style={{ minHeight: "36px", padding: "0.3rem 0.85rem", fontSize: "0.82rem" }}
                          >
                            Kelola Milestone
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. TAMPILAN BUAT PENGGALANGAN DANA BARU */}
          {activeMenu === "organizer-create" && (
            <div style={{ maxWidth: "720px", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.5rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                Buka Penggalangan Dana Escrow Baru
              </h2>
              <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
                Semua parameter program akan dikunci di smart contract Ethereum/Hardhat secara transparan.
              </p>

              {formError && (
                <div style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "0.75rem", borderRadius: "var(--radius-sm)", marginBottom: "1rem", fontSize: "0.85rem" }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label className="form-label">Target Penggalangan (Rupiah):</label>
                  <input
                    type="text"
                    value={formatRupiah(targetIdr)}
                    onChange={(e) => setTargetIdr(parseRupiahInput(e.target.value))}
                    className="form-input"
                    required
                  />
                  <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>
                    Setara dengan ~{idrToEth(targetIdr)} ETH di blockchain
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label className="form-label">Durasi Penggalangan (Hari):</label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={daysInput}
                      onChange={(e) => setDaysInput(Number(e.target.value))}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Biaya Operasional Yayasan (%):</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={opCostPercent}
                      onChange={(e) => setOpCostPercent(Number(e.target.value))}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Alamat Verifikator Independen:</label>
                  <input
                    type="text"
                    value={verifierInput}
                    onChange={(e) => setVerifierInput(e.target.value)}
                    className="form-input"
                    style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Alamat Pelaksana Lapangan:</label>
                  <input
                    type="text"
                    value={executorInput}
                    onChange={(e) => setExecutorInput(e.target.value)}
                    className="form-input"
                    style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Proporsi Pembagian Milestone (% per tahap, total 100):</label>
                  <input
                    type="text"
                    value={sharesInput}
                    onChange={(e) => setSharesInput(e.target.value)}
                    className="form-input"
                    placeholder="Contoh: 30, 30, 40"
                    required
                  />
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                    Buka Penggalangan On-Chain
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMenu("organizer-campaigns")}
                    className="btn-secondary"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 5. TAMPILAN SALDO & KLAIM ESCROW */}
          {activeMenu === "claims" && (
            <div style={{ maxWidth: "720px", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.5rem" }}>
                <span className="card-badge-status" style={{ backgroundColor: "rgba(13, 148, 136, 0.15)", color: "var(--color-teal)" }}>
                  Hak Tarik On-Chain
                </span>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-primary)", marginTop: "0.5rem" }}>
                  {claimableEth.toFixed(4)} ETH
                </div>
                <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                  Setara dengan {formatRupiah(claimableIdr)}
                </div>

                {claimableEth > 0 ? (
                  <button
                    type="button"
                    onClick={onWithdraw}
                    className="btn-teal"
                    style={{ width: "100%", fontWeight: 700 }}
                  >
                    Tarik Dana ke Dompet Saya
                  </button>
                ) : (
                  <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", padding: "0.5rem 0" }}>
                    Saat ini belum ada saldo yang siap dicairkan untuk akun Anda. Saldo bertambah saat biaya operasional disetujui (yayasan) atau saat milestone disahkan oleh verifikator (pelaksana).
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                  Ketentuan Hak Tarik Sesuai Peran:
                </h3>
                <ul style={{ paddingLeft: "1.2rem", fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <li><strong>Penyelenggara (Yayasan):</strong> Berhak menarik biaya operasional (opCostBps) setelah masa penggalangan dana dinyatakan sukses dan difinalisasi.</li>
                  <li><strong>Pelaksana Lapangan:</strong> Berhak menarik alokasi dana per milestone setelah bukti pelaksanaan disetujui oleh verifikator independen.</li>
                  <li><strong>Donatur Publik:</strong> Menarik dana melalui mekanisme refund apabila kampanye gagal mencapai target atau sengketa dimenangkan donatur.</li>
                </ul>
              </div>
            </div>
          )}

          {/* 6. TAMPILAN PENGAWASAN & ESKALASI (REGULATOR) */}
          {activeMenu === "regulator-oversight" && (
            <div>
              {escalatedMilestones.length === 0 ? (
                <div className="state-box">
                  <div className="state-icon">⚖️</div>
                  <h3 className="state-title">Tidak Ada Sengketa Aktif</h3>
                  <p className="state-desc">
                    Semua kampanye dan milestone berjalan normal tanpa eskalasi sengketa dari donatur atau pelaksana.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {escalatedMilestones.map(({ campaign, milestone }) => (
                    <div
                      key={`${campaign.id}-${milestone.index}`}
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--color-danger)",
                        borderRadius: "var(--radius-md)",
                        padding: "1.25rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--color-danger)" }}>
                            ⚠️ Kasus Eskalasi: Kampanye #{campaign.id} - Milestone #{milestone.index + 1}
                          </span>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                            {getCampaignMetadata(campaign.id).title}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectCampaign(campaign)}
                          className="btn-primary"
                          style={{ minHeight: "32px", fontSize: "0.8rem", padding: "0.25rem 0.65rem" }}
                        >
                          Buka Detail Kasus
                        </button>
                      </div>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0.5rem 0" }}>
                        Milestone ini tereskalasi karena verifikator tidak merespons dalam jendela verifikasi. Dana tidak dilepas otomatis. Regulator dapat mengganti verifikator melalui skrip, belum melalui antarmuka.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 7. TAMPILAN SEMUA KAMPANYE DALAM SISTEM */}
          {activeMenu === "all-campaigns" && (
            <div>
              <p style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                Seluruh daftar program donasi on-chain yang tercatat di smart contract escrow.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {campaigns.map((camp) => {
                  const meta = getCampaignMetadata(camp.id);
                  const targetEth = parseFloat(formatEther(camp.fundingTarget));
                  const raisedEth = parseFloat(formatEther(camp.totalRaised));
                  const percent = targetEth > 0 ? Math.min(100, Math.round((raisedEth / targetEth) * 100)) : 0;
                  return (
                    <div
                      key={camp.id}
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        padding: "1rem 1.25rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                          <span className="badge-category">{meta.category}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>ID #{camp.id}</span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{meta.title}</div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>
                          Penyelenggara: {camp.organizer.slice(0, 6)}...{camp.organizer.slice(-4)} | Target: {targetEth} ETH ({percent}% terkumpul)
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectCampaign(camp)}
                        className="btn-secondary"
                        style={{ minHeight: "34px", padding: "0.3rem 0.8rem", fontSize: "0.82rem" }}
                      >
                        Detail & Milestone
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
