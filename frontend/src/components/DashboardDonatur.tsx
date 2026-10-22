import React from "react";
import { Campaign, CampaignStatus, CAMPAIGN_STATUS_LABELS } from "../types/escrow";
import { useWeb3 } from "../context/Web3Context";
import { formatRupiah, ethToIdr } from "../utils/currency";

interface DashboardDonaturProps {
  campaigns: Campaign[];
  userContributions: Record<number, { amount: bigint; refunded: boolean; disputeUsed: boolean }>;
  onSelectCampaign: (campaign: Campaign) => void;
  onRefund: (campaignId: number) => Promise<boolean>;
  onOpenDispute: (campaignId: number) => Promise<boolean>;
}

export const DashboardDonatur: React.FC<DashboardDonaturProps> = ({
  campaigns,
  userContributions,
  onSelectCampaign,
  onRefund,
  onOpenDispute,
}) => {
  const { account, openConnectModal } = useWeb3();

  if (!account) {
    return (
      <div className="state-box">
        <div className="state-icon">🔒</div>
        <h3 className="state-title">Hubungkan Dompet Anda</h3>
        <p className="state-desc">
          Sambungkan dompet Web3 Anda untuk melihat riwayat donasi dan status hak perlindungan escrow Anda.
        </p>
        <button type="button" onClick={openConnectModal} className="btn-primary">
          Hubungkan Dompet
        </button>
      </div>
    );
  }

  // Filter kampanye di mana pengguna pernah berdonasi
  const contributedCampaigns = campaigns.filter((c) => {
    const contrib = userContributions[c.id];
    return contrib && contrib.amount > 0n;
  });

  const totalDonatedIdr = contributedCampaigns.reduce((acc, c) => {
    const contrib = userContributions[c.id];
    return acc + (contrib ? ethToIdr(contrib.amount) : 0);
  }, 0);

  if (contributedCampaigns.length === 0) {
    return (
      <div className="state-box">
        <div className="state-icon">📋</div>
        <h3 className="state-title">Belum Ada Riwayat Donasi</h3>
        <p className="state-desc">
          Dompet Anda belum tercatat menyumbang pada kampanye mana pun di blockchain saat ini.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem 0 3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Dasbor Donasi Saya</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Transparansi status dana donasi Anda yang dikelola oleh smart contract escrow.
          </p>
        </div>
        <div style={{ backgroundColor: "var(--bg-surface)", padding: "0.6rem 1.2rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>Total Donasi Anda</div>
          <div style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: "1.15rem" }}>
            {formatRupiah(totalDonatedIdr)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {contributedCampaigns.map((c) => {
          const contrib = userContributions[c.id];
          const contribIdr = contrib ? ethToIdr(contrib.amount) : 0;
          const statusInfo = CAMPAIGN_STATUS_LABELS[c.status];
          const meetsDispute = c.totalRaised > 0n && contrib && contrib.amount * 10000n >= c.totalRaised * 500n;

          return (
            <div
              key={c.id}
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
              <div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.4rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Kampanye #{c.id}</span>
                  <span className={`badge ${statusInfo.colorClass}`}>{statusInfo.label}</span>
                  {contrib.refunded && (
                    <span className="badge" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}>
                      Sudah Refund
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                  Nominal Donasi Anda: <strong style={{ color: "var(--text-main)" }}>{formatRupiah(contribIdr)}</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => onSelectCampaign(c)}
                  className="btn-secondary"
                  style={{ minHeight: "38px", padding: "0.3rem 0.8rem", fontSize: "0.85rem" }}
                >
                  Lihat Rincian
                </button>

                {/* Tombol Refund jika gagal / batal dan belum refund */}
                {(c.status === CampaignStatus.Failed || c.status === CampaignStatus.Cancelled) && !contrib.refunded && (
                  <button
                    type="button"
                    onClick={() => onRefund(c.id)}
                    className="btn-primary"
                    style={{ minHeight: "38px", padding: "0.3rem 0.8rem", fontSize: "0.85rem" }}
                  >
                    Klaim Refund ({formatRupiah(contribIdr)})
                  </button>
                )}

                {/* Tombol Sengketa jika status aktif, porsi >= 5%, dan belum pernah dipakai */}
                {c.status === CampaignStatus.Active && meetsDispute && !contrib.disputeUsed && (
                  <button
                    type="button"
                    onClick={() => onOpenDispute(c.id)}
                    className="btn-outline-amber"
                    style={{ minHeight: "38px", padding: "0.3rem 0.8rem", fontSize: "0.85rem" }}
                  >
                    Buka Sengketa
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
