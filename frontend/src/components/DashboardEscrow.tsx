import React, { useState } from "react";
import { formatEther } from "ethers";
import { Campaign, CampaignStatus, MilestoneStatus } from "../types/escrow";
import { useWeb3 } from "../context/Web3Context";
import { formatRupiah, ethToIdr, idrToEth, parseRupiahInput } from "../utils/currency";

interface DashboardEscrowProps {
  campaigns: Campaign[];
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
  onSelectCampaign: (campaign: Campaign) => void;
}

export const DashboardEscrow: React.FC<DashboardEscrowProps> = ({
  campaigns,
  onWithdraw,
  onCreateCampaign,
  onSubmitEvidence,
  onApproveMilestone,
  onRejectMilestone,
  onSelectCampaign,
}) => {
  const { account, userRole, openConnectModal } = useWeb3();

  const [activeSubTab, setActiveSubTab] = useState<"claim" | "executor" | "verifier" | "create">("claim");

  // State form buat kampanye baru dalam Rupiah (default Rp 50.000.000)
  const [targetIdr, setTargetIdr] = useState<number>(50000000);
  const [daysInput, setDaysInput] = useState<number>(30);
  const [opCostPercent, setOpCostPercent] = useState<number>(5);
  const [verifierInput, setVerifierInput] = useState<string>("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  const [executorInput, setExecutorInput] = useState<string>("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65");
  const [sharesInput, setSharesInput] = useState<string>("30, 30, 40");
  const [formError, setFormError] = useState<string | null>(null);

  // State upload bukti pelaksana
  const [evidenceMap, setEvidenceMap] = useState<Record<string, string>>({});

  if (!account) {
    return (
      <div className="state-box">
        <div className="state-icon">🔒</div>
        <h3 className="state-title">Hubungkan Dompet Anda</h3>
        <p className="state-desc">
          Masuk dengan dompet Web3 untuk mengakses panel pencairan dana dan tugas pengelolaan escrow.
        </p>
        <button type="button" onClick={openConnectModal} className="btn-primary">
          Hubungkan Dompet
        </button>
      </div>
    );
  }

  const claimableIdr = ethToIdr(userRole.claimableBalance);
  const claimableEth = parseFloat(formatEther(userRole.claimableBalance));

  // Milestones yang butuh tindakan pelaksana
  const executorTasks = campaigns.flatMap((c) => {
    if (c.status !== CampaignStatus.Active) return [];
    if (c.executor.toLowerCase() !== account.toLowerCase()) return [];
    return c.milestones
      .filter((m) => m.status === MilestoneStatus.Pending || m.status === MilestoneStatus.Rejected)
      .map((m) => ({ campaign: c, milestone: m }));
  });

  // Milestones yang butuh telaah verifikator
  const verifierTasks = campaigns.flatMap((c) => {
    if (c.status !== CampaignStatus.Active) return [];
    if (c.verifier.toLowerCase() !== account.toLowerCase()) return [];
    return c.milestones
      .filter((m) => m.status === MilestoneStatus.Submitted)
      .map((m) => ({ campaign: c, milestone: m }));
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (targetIdr < 1000000) {
      setFormError("Target pendanaan minimal adalah Rp 1.000.000.");
      return;
    }

    const sharesArr = sharesInput
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));

    const totalPercent = sharesArr.reduce((a, b) => a + b, 0);
    if (Math.round(totalPercent) !== 100) {
      setFormError(`Total porsi milestone harus tepat 100% (saat ini ${totalPercent}%).`);
      return;
    }

    const sharesBps = sharesArr.map((p) => Math.round(p * 100));
    const deadlineEpoch = Math.floor(Date.now() / 1000) + daysInput * 24 * 3600;
    const opCostBps = Math.round(opCostPercent * 100);

    const targetEthStr = idrToEth(targetIdr);
    const dummyHash = "0x" + "aa".repeat(32);

    const ok = await onCreateCampaign(
      dummyHash,
      targetEthStr,
      deadlineEpoch,
      opCostBps,
      verifierInput.trim(),
      executorInput.trim(),
      sharesBps
    );

    if (ok) {
      setActiveSubTab("claim");
    }
  };

  return (
    <div style={{ padding: "1.5rem 0 3rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Dasbor Pengelolaan Escrow</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Panel khusus pencairan dana terkunci, tugas verifikasi, dan administrasi peran smart contract.
        </p>
      </div>

      {/* Sub Tabs */}
      <div className="filter-pills" style={{ marginBottom: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveSubTab("claim")}
          className={`filter-btn ${activeSubTab === "claim" ? "active" : ""}`}
        >
          Klaim Saldo ({formatRupiah(claimableIdr)})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("executor")}
          className={`filter-btn ${activeSubTab === "executor" ? "active" : ""}`}
        >
          Tugas Pelaksana ({executorTasks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("verifier")}
          className={`filter-btn ${activeSubTab === "verifier" ? "active" : ""}`}
        >
          Antrean Verifikator ({verifierTasks.length})
        </button>
        {userRole.isOrganizer && (
          <button
            type="button"
            onClick={() => setActiveSubTab("create")}
            className={`filter-btn ${activeSubTab === "create" ? "active" : ""}`}
          >
            + Buat Penggalangan Baru
          </button>
        )}
      </div>

      {/* Konten Sub Tab 1: Klaim Saldo dalam Rupiah */}
      {activeSubTab === "claim" && (
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "1.5rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Saldo Siap Ditarik (Claimable Balance)
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
            Sistem menggunakan pola <em>Pull-over-Push</em>. Ketika milestone berhasil dirilis, dana tidak langsung ditransfer ke dompet secara otomatis demi keamanan, melainkan dicatat sebagai saldo klaim yang dapat Anda tarik kapan saja.
          </p>

          <div style={{ backgroundColor: "var(--bg-surface)", padding: "1.25rem", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Saldo Milik Anda di Smart Contract</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-primary)" }}>
                {formatRupiah(claimableIdr)}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                (~{claimableEth.toFixed(4)} ETH)
              </div>
            </div>

            <button
              type="button"
              onClick={onWithdraw}
              disabled={userRole.claimableBalance === 0n}
              className="btn-primary"
            >
              Tarik Dana ke Dompet (Withdraw)
            </button>
          </div>
        </div>
      )}

      {/* Konten Sub Tab 2: Tugas Pelaksana */}
      {activeSubTab === "executor" && (
        <div>
          {executorTasks.length === 0 ? (
            <div className="state-box">
              <div className="state-icon">✅</div>
              <h3 className="state-title">Tidak Ada Tugas Milestone Tertunda</h3>
              <p className="state-desc">
                Semua milestone di mana Anda bertindak sebagai pelaksana telah diserahkan atau selesai dicairkan.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {executorTasks.map(({ campaign, milestone }) => {
                const key = `${campaign.id}-${milestone.index}`;
                return (
                  <div key={key} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: 700 }}>Kampanye #{campaign.id} - Milestone #{milestone.index + 1}</span>
                      <span className="badge badge-funding">Menunggu Bukti</span>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                      <input
                        type="text"
                        placeholder="Masukkan hash bukti (bytes32)..."
                        value={evidenceMap[key] || ""}
                        onChange={(e) => setEvidenceMap({ ...evidenceMap, [key]: e.target.value })}
                        className="form-input"
                        style={{ flex: 1, minHeight: "40px", fontSize: "0.85rem" }}
                      />
                      <button
                        type="button"
                        onClick={() => onSubmitEvidence(campaign.id, milestone.index, evidenceMap[key] || ("0x" + "22".repeat(32)))}
                        className="btn-primary"
                        style={{ minHeight: "40px" }}
                      >
                        Kirim Bukti
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Konten Sub Tab 3: Antrean Verifikator */}
      {activeSubTab === "verifier" && (
        <div>
          {verifierTasks.length === 0 ? (
            <div className="state-box">
              <div className="state-icon">🛡️</div>
              <h3 className="state-title">Antrean Verifikasi Kosong</h3>
              <p className="state-desc">
                Saat ini belum ada pengajuan bukti milestone baru yang menunggu telaah Anda.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {verifierTasks.map(({ campaign, milestone }) => (
                <div key={`${campaign.id}-${milestone.index}`} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: 700 }}>Kampanye #{campaign.id} - Milestone #{milestone.index + 1}</span>
                    <span className="badge badge-active">Bukti Diserahkan</span>
                  </div>
                  <div className="milestone-hash">Hash Dokumen: {milestone.evidenceHash}</div>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                    <button
                      type="button"
                      onClick={() => onApproveMilestone(campaign.id, milestone.index)}
                      className="btn-primary"
                    >
                      Setujui Milestone
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectMilestone(campaign.id, milestone.index, 1)}
                      className="btn-outline-danger"
                    >
                      Tolak Bukti
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectCampaign(campaign)}
                      className="btn-secondary"
                    >
                      Lihat Rincian Kampanye
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Konten Sub Tab 4: Form Buat Kampanye dalam Rupiah */}
      {activeSubTab === "create" && userRole.isOrganizer && (
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "1.75rem", maxWidth: "640px" }}>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Buat Kampanye Donasi Baru
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
            Sebagai penyelenggara terdaftar, Anda dapat membuka penggalangan baru dengan menetapkan target dana, pelaksana, dan verifikator independen.
          </p>

          <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label className="form-label">Target Pendanaan (Rupiah)</label>
              <input
                type="text"
                value={targetIdr ? targetIdr.toLocaleString("id-ID") : ""}
                onChange={(e) => setTargetIdr(parseRupiahInput(e.target.value))}
                placeholder="Contoh: 50.000.000"
                className="form-input"
                required
              />
              <div className="form-hint">
                Setara ~{idrToEth(targetIdr)} ETH pada smart contract blockchain
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Tenggat Waktu (Hari)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={daysInput}
                  onChange={(e) => setDaysInput(Number(e.target.value))}
                  className="form-input"
                  required
                />
                <div className="form-hint">Maksimal 365 hari</div>
              </div>

              <div className="form-group">
                <label className="form-label">Biaya Operasional (%)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={opCostPercent}
                  onChange={(e) => setOpCostPercent(Number(e.target.value))}
                  className="form-input"
                  required
                />
                <div className="form-hint">Maksimal 10%</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Alamat Verifikator Independen</label>
              <input
                type="text"
                value={verifierInput}
                onChange={(e) => setVerifierInput(e.target.value)}
                className="form-input"
                required
              />
              <div className="form-hint">Wajib akun verifikator yang disetujui Regulator</div>
            </div>

            <div className="form-group">
              <label className="form-label">Alamat Pelaksana Lapangan (Executor)</label>
              <input
                type="text"
                value={executorInput}
                onChange={(e) => setExecutorInput(e.target.value)}
                className="form-input"
                required
              />
              <div className="form-hint">Pihak yang bertugas mengeksekusi kegiatan</div>
            </div>

            <div className="form-group">
              <label className="form-label">Porsi Persentase Milestone (%)</label>
              <input
                type="text"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                className="form-input"
                placeholder="30, 30, 40"
                required
              />
              <div className="form-hint">Pisahkan dengan koma, jumlah total wajib 100%</div>
            </div>

            {formError && (
              <div style={{ color: "var(--color-rose)", fontSize: "0.85rem", marginBottom: "1rem", backgroundColor: "var(--color-rose-bg)", padding: "0.6rem 0.8rem", borderRadius: "var(--radius-sm)" }}>
                {formError}
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: "100%" }}>
              Buka Penggalangan di Blockchain
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
