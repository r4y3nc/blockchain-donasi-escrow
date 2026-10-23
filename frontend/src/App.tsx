import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { CampaignCard } from "./components/CampaignCard";
import { CampaignDetailModal } from "./components/CampaignDetailModal";
import { DonateModal } from "./components/DonateModal";
import { TransactionModal } from "./components/TransactionModal";
import { DashboardDonatur } from "./components/DashboardDonatur";
import { DashboardEscrow } from "./components/DashboardEscrow";
import { DemoAccountsModal } from "./components/DemoAccountsModal";
import { ConnectWalletModal } from "./components/ConnectWalletModal";
import { CreateCampaignModal } from "./components/CreateCampaignModal";
import { OperatorSidebarLayout } from "./components/OperatorSidebarLayout";
import { useEscrow } from "./hooks/useEscrow";
import { useWeb3 } from "./context/Web3Context";
import { Campaign, CampaignStatus } from "./types/escrow";
import {
  DEFAULT_PRAYERS,
  DonorPrayer,
  CampaignMetadata,
  getCampaignMetadata,
  saveCustomCampaignMetadata,
} from "./types/campaignMetadata";
import { formatEther } from "ethers";
import { formatEthToRupiah, idrToEth } from "./utils/currency";

export const App: React.FC = () => {
  const {
    campaigns,
    userContributions,
    isLoading,
    loadError,
    txState,
    fetchCampaigns,
    closeTxModal,
    donate,
    finalizeFunding,
    submitEvidence,
    approveMilestone,
    rejectMilestone,
    escalate,
    release,
    refund,
    withdraw,
    openDispute,
    createCampaign,
    fastForwardTime,
  } = useEscrow();

  const { account, userRole } = useWeb3();

  const [activeTab, setActiveTab] = useState<"campaigns" | "my-donations" | "escrow-mgmt">("campaigns");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [donatingCampaign, setDonatingCampaign] = useState<Campaign | null>(null);
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState<boolean>(false);
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isPublicPreviewMode, setIsPublicPreviewMode] = useState<boolean>(false);

  // Simpan doa donatur
  const [prayers, setPrayers] = useState<DonorPrayer[]>(DEFAULT_PRAYERS);

  // Sync theme attribute to body
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const handleDonateWithPrayer = async (
    campaignId: number,
    amount: string,
    donorName?: string,
    prayer?: string
  ) => {
    const ok = await donate(campaignId, amount);
    if (ok) {
      if (prayer) {
        const newPrayer: DonorPrayer = {
          id: `p-${Date.now()}`,
          campaignId,
          donorName: donorName || "Hamba Allah",
          amountRupiah: formatEthToRupiah(amount),
          prayer,
          timestamp: Date.now(),
        };
        setPrayers((prev) => [newPrayer, ...prev]);
      }
    }
    return ok;
  };

  const handleCreateCampaign = async (
    title: string,
    category: "Pendidikan" | "Medis & Kesehatan" | "Bencana Alam" | "Panti Asuhan" | "Sarana Ibadah" | "Sosial",
    story: string,
    targetIdr: number,
    days: number,
    opCostPercent: number,
    verifier: string,
    executor: string,
    sharesBps: number[]
  ) => {
    const deadlineEpoch = Math.floor(Date.now() / 1000) + days * 24 * 3600;
    const opCostBps = Math.round(opCostPercent * 100);
    const targetEthStr = idrToEth(targetIdr);
    // 32-byte hex hash untuk metadataHash
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const metadataHash = "0x" + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    const ok = await createCampaign(
      metadataHash,
      targetEthStr,
      deadlineEpoch,
      opCostBps,
      verifier,
      executor,
      sharesBps
    );

    if (ok) {
      const nextId = campaigns.length + 1;
      const categoryImages: Record<string, string> = {
        Pendidikan: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80",
        "Medis & Kesehatan": "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop&q=80",
        "Bencana Alam": "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&auto=format&fit=crop&q=80",
        "Panti Asuhan": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&auto=format&fit=crop&q=80",
        "Sarana Ibadah": "https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800&auto=format&fit=crop&q=80",
        Sosial: "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&auto=format&fit=crop&q=80",
      };

      const newMeta: CampaignMetadata = {
        id: nextId,
        title,
        category,
        organizerName: "Yayasan Peduli",
        story: story || "Penggalangan dana amanah dengan pengawasan verifikator independen dan pencairan bertahap escrow.",
        imageUrl: categoryImages[category] || categoryImages["Sosial"],
        targetUse: [
          `Penyaluran tahap 1 (${sharesBps[0] ? sharesBps[0] / 100 : 30}%)`,
          `Penyaluran tahap 2 (${sharesBps[1] ? sharesBps[1] / 100 : 30}%)`,
          `Penyelesaian proyek (${sharesBps[2] ? sharesBps[2] / 100 : 40}%)`,
        ],
      };
      saveCustomCampaignMetadata(newMeta);
      await fetchCampaigns();
    }
    return ok;
  };

  // Filter kampanye
  const filteredCampaigns = campaigns.filter((c) => {
    const meta = getCampaignMetadata(c.id);

    // Filter Kategori
    if (selectedCategory !== "Semua" && meta.category !== selectedCategory) {
      return false;
    }

    // Filter Status
    if (selectedStatusFilter === "funding" && c.status !== CampaignStatus.Funding) return false;
    if (selectedStatusFilter === "active" && c.status !== CampaignStatus.Active) return false;
    if (selectedStatusFilter === "completed" && c.status !== CampaignStatus.Completed) return false;
    if (selectedStatusFilter === "failed" && c.status !== CampaignStatus.Failed && c.status !== CampaignStatus.Cancelled) return false;

    // Filter Pencarian
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = meta.title.toLowerCase().includes(q);
      const matchCategory = meta.category.toLowerCase().includes(q);
      const matchOrg = meta.organizerName.toLowerCase().includes(q);
      if (!matchTitle && !matchCategory && !matchOrg) return false;
    }

    return true;
  });

  const totalEthRaised = campaigns.reduce((acc, c) => acc + parseFloat(formatEther(c.totalRaised)), 0);
  const isCampaignExecutor = campaigns.some(
    (c) => account && c.executor.toLowerCase() === account.toLowerCase()
  );
  const isDemoExecutor =
    account && account.toLowerCase() === "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65".toLowerCase();
  const isExecutor = userRole.isExecutor || isCampaignExecutor || !!isDemoExecutor;
  const isOperator = userRole.isOrganizer || userRole.isVerifier || isExecutor || userRole.isRegulator;

  // Tampilan Konsol Sidebar Khusus Akun Operasional (Selain Donatur)
  if (isOperator && !isPublicPreviewMode) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <OperatorSidebarLayout
          campaigns={campaigns}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenDemoGuide={() => setIsDemoGuideOpen(true)}
          onSelectCampaign={(c) => setSelectedCampaign(c)}
          onWithdraw={withdraw}
          onCreateCampaign={createCampaign}
          onSubmitEvidence={submitEvidence}
          onApproveMilestone={approveMilestone}
          onRejectMilestone={rejectMilestone}
          onSwitchToPublic={() => setIsPublicPreviewMode(true)}
        />

        {/* MODAL: DETAIL KAMPANYE LENGKAP */}
        {selectedCampaign && (
          <CampaignDetailModal
            campaign={selectedCampaign}
            userContribution={userContributions[selectedCampaign.id] || { amount: 0n, refunded: false, disputeUsed: false }}
            prayers={prayers}
            onClose={() => setSelectedCampaign(null)}
            onOpenDonate={(c) => {
              setSelectedCampaign(null);
              setDonatingCampaign(c);
            }}
            onFinalizeFunding={finalizeFunding}
            onSubmitEvidence={submitEvidence}
            onApproveMilestone={approveMilestone}
            onRejectMilestone={rejectMilestone}
            onEscalate={escalate}
            onRelease={release}
            onRefund={refund}
            onOpenDispute={openDispute}
          />
        )}

        {/* MODAL: FORMULIR DONASI */}
        {donatingCampaign && (
          <DonateModal
            campaign={donatingCampaign}
            onClose={() => setDonatingCampaign(null)}
            onDonate={handleDonateWithPrayer}
          />
        )}

        {/* MODAL: STATUS TRANSAKSI BLOCKCHAIN NYATA */}
        <TransactionModal txState={txState} onClose={closeTxModal} onFastForwardTime={fastForwardTime} />

        {/* MODAL: PANDUAN AKUN UJI HARDHAT */}
        {isDemoGuideOpen && (
          <DemoAccountsModal onClose={() => setIsDemoGuideOpen(false)} />
        )}

        {/* MODAL: FORMULIR BUAT PENGGALANGAN DANA BARU */}
        <CreateCampaignModal
          isOpen={isCreateCampaignOpen}
          onClose={() => setIsCreateCampaignOpen(false)}
          onCreate={handleCreateCampaign}
        />

        {/* MODAL: PILIHAN HUBUNGKAN DOMPET */}
        <ConnectWalletModal />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Banner Mode Tinjau Publik Khusus Operator */}
      {isOperator && isPublicPreviewMode && (
        <div className="operator-preview-banner">
          <span>
            👁️ Mode Tinjau Publik Aktif. Anda melihat tampilan dari sudut pandang donatur umum.
          </span>
          <button
            type="button"
            onClick={() => setIsPublicPreviewMode(false)}
            className="btn-secondary"
            style={{ minHeight: "30px", fontSize: "0.8rem", padding: "0.2rem 0.65rem", background: "white", color: "#0f766e", fontWeight: 700 }}
          >
            ← Kembali ke Konsol Sidebar
          </button>
        </div>
      )}

      <Navbar
        onOpenDemoGuide={() => setIsDemoGuideOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenCreateCampaign={() => setIsCreateCampaignOpen(true)}
      />

      {/* Hero Banner (Hanya di Tab Kampanye) */}
      {activeTab === "campaigns" && (
        <Hero
          totalCampaigns={campaigns.length}
          totalEthRaised={totalEthRaised}
          onExploreClick={() => {
            const el = document.getElementById("campaign-catalog");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}

      {/* Navigasi Tab Utama */}
      <nav className="container page-tabs" aria-label="Navigasi Halaman Utama">
        <button
          type="button"
          onClick={() => setActiveTab("campaigns")}
          className={`tab-btn ${activeTab === "campaigns" ? "active" : ""}`}
        >
          Katalog Donasi ({campaigns.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("my-donations")}
          className={`tab-btn ${activeTab === "my-donations" ? "active" : ""}`}
        >
          Donasi Saya
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("escrow-mgmt")}
          className={`tab-btn ${activeTab === "escrow-mgmt" ? "active" : ""}`}
        >
          Dasbor Escrow & Klaim
        </button>
      </nav>

      <main className="container" style={{ flex: 1 }}>
        {/* TAB 1: KATALOG KAMPANYE */}
        {activeTab === "campaigns" && (
          <section id="campaign-catalog" style={{ padding: "0.5rem 0" }}>
            {/* Banner Khusus Akun Penyelenggara Resmi */}
            {userRole.isOrganizer && (
              <div
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderLeft: "4px solid var(--color-primary)",
                  borderRadius: "var(--radius-md)",
                  padding: "1rem 1.25rem",
                  marginBottom: "1.25rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span className="role-pill role-organizer">Penyelenggara Terverifikasi</span>
                    <strong style={{ fontSize: "0.95rem", color: "var(--text-main)" }}>Panel Yayasan & Penggalangan Dana</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Akun Anda memiliki izin on-chain untuk membuka program penggalangan donasi baru dan menentukan verifikator independen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateCampaignOpen(true)}
                  className="btn-primary"
                  style={{ minHeight: "40px", padding: "0.45rem 1.15rem", fontSize: "0.9rem", fontWeight: 700 }}
                >
                  + Buka Penggalangan Baru
                </button>
              </div>
            )}

            {/* Kategori Pills ala Kitabisa */}
            <div className="category-pills" role="tablist" aria-label="Filter Kategori Donasi">
              {["Semua", "Pendidikan", "Medis & Kesehatan", "Bencana Alam", "Panti Asuhan", "Sarana Ibadah", "Sosial"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`category-pill-btn ${selectedCategory === cat ? "active" : ""}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Filter & Kolom Pencarian */}
            <div className="filter-bar">
              <div className="search-input-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Cari kampanye atau yayasan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{ minHeight: "24px", minWidth: "24px", padding: 0, color: "var(--text-dim)" }}
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter("all")}
                  className={`filter-btn ${selectedStatusFilter === "all" ? "active" : ""}`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter("funding")}
                  className={`filter-btn ${selectedStatusFilter === "funding" ? "active" : ""}`}
                >
                  Sedang Menggalang
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter("active")}
                  className={`filter-btn ${selectedStatusFilter === "active" ? "active" : ""}`}
                >
                  Milestone Berjalan
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter("completed")}
                  className={`filter-btn ${selectedStatusFilter === "completed" ? "active" : ""}`}
                >
                  Selesai
                </button>
              </div>
            </div>

            {/* 3 Status UI: Loading, Error, Empty (R-27) */}
            {isLoading && (
              <div className="state-box">
                <div className="spinner" />
                <h3 className="state-title">Menghubungkan ke Blockchain Lokal</h3>
                <p className="state-desc">Membaca daftar kampanye dan tahapan milestone langsung dari smart contract...</p>
              </div>
            )}

            {!isLoading && loadError && (
              <div className="state-box">
                <div className="state-icon">⚠️</div>
                <h3 className="state-title">Node Hardhat Belum Aktif</h3>
                <p className="state-desc">{loadError}</p>
                <div style={{ backgroundColor: "var(--bg-surface)", padding: "0.75rem", borderRadius: "var(--radius-sm)", fontFamily: "monospace", fontSize: "0.82rem", marginBottom: "1rem" }}>
                  Jalankan di terminal utama: npm run node
                </div>
                <button type="button" onClick={fetchCampaigns} className="btn-primary">
                  Hubungkan Ulang
                </button>
              </div>
            )}

            {!isLoading && !loadError && filteredCampaigns.length === 0 && (
              <div className="state-box">
                <div className="state-icon">🔍</div>
                <h3 className="state-title">Tidak Ada Kampanye yang Cocok</h3>
                <p className="state-desc">
                  Tidak ditemukan penggalangan donasi yang sesuai dengan kata kunci atau filter kategori yang dipilih.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("Semua");
                    setSelectedStatusFilter("all");
                    setSearchQuery("");
                  }}
                  className="btn-secondary"
                >
                  Atur Ulang Pencarian
                </button>
              </div>
            )}

            {/* Grid Kartu Kampanye */}
            {!isLoading && !loadError && filteredCampaigns.length > 0 && (
              <div className="campaign-grid">
                {filteredCampaigns.map((camp) => (
                  <CampaignCard
                    key={camp.id}
                    campaign={camp}
                    onSelect={(c) => setSelectedCampaign(c)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: DASHBOARD DONATUR */}
        {activeTab === "my-donations" && (
          <DashboardDonatur
            campaigns={campaigns}
            userContributions={userContributions}
            onSelectCampaign={(c) => setSelectedCampaign(c)}
            onRefund={refund}
            onOpenDispute={openDispute}
          />
        )}

        {/* TAB 3: DASHBOARD ESCROW & KLAIM */}
        {activeTab === "escrow-mgmt" && (
          <DashboardEscrow
            campaigns={campaigns}
            onWithdraw={withdraw}
            onCreateCampaign={createCampaign}
            onSubmitEvidence={submitEvidence}
            onApproveMilestone={approveMilestone}
            onRejectMilestone={rejectMilestone}
            onSelectCampaign={(c) => setSelectedCampaign(c)}
          />
        )}
      </main>

      {/* MODAL: DETAIL KAMPANYE LENGKAP */}
      {selectedCampaign && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          userContribution={userContributions[selectedCampaign.id] || { amount: 0n, refunded: false, disputeUsed: false }}
          prayers={prayers}
          onClose={() => setSelectedCampaign(null)}
          onOpenDonate={(c) => {
            setSelectedCampaign(null);
            setDonatingCampaign(c);
          }}
          onFinalizeFunding={finalizeFunding}
          onSubmitEvidence={submitEvidence}
          onApproveMilestone={approveMilestone}
          onRejectMilestone={rejectMilestone}
          onEscalate={escalate}
          onRelease={release}
          onRefund={refund}
          onOpenDispute={openDispute}
        />
      )}

      {/* MODAL: FORMULIR DONASI */}
      {donatingCampaign && (
        <DonateModal
          campaign={donatingCampaign}
          onClose={() => setDonatingCampaign(null)}
          onDonate={handleDonateWithPrayer}
        />
      )}

      {/* MODAL: STATUS TRANSAKSI BLOCKCHAIN NYATA */}
      <TransactionModal txState={txState} onClose={closeTxModal} onFastForwardTime={fastForwardTime} />

      {/* MODAL: PANDUAN AKUN UJI HARDHAT */}
      {isDemoGuideOpen && (
        <DemoAccountsModal onClose={() => setIsDemoGuideOpen(false)} />
      )}

      {/* MODAL: FORMULIR BUAT PENGGALANGAN DANA BARU */}
      <CreateCampaignModal
        isOpen={isCreateCampaignOpen}
        onClose={() => setIsCreateCampaignOpen(false)}
        onCreate={handleCreateCampaign}
      />

      {/* MODAL: PILIHAN HUBUNGKAN DOMPET */}
      <ConnectWalletModal />

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-content">
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--color-primary)", marginBottom: "0.2rem" }}>
              DonationEscrow DApp
            </div>
            <div>Platform Donasi Gotong Royong Berbasis Escrow Blockchain & Verifikator Independen</div>
          </div>
          <div style={{ textAlign: "right", fontSize: "0.82rem" }}>
            <div>Jaringan Uji: <strong>Hardhat Localhost (Chain ID: 31337)</strong></div>
            <div style={{ color: "var(--text-dim)" }}>Smart Contract: 0x5FbDB2315678afecb367f032d93F642f64180aa3</div>
          </div>
        </div>
      </footer>
    </div>
  );
};
