import React from "react";
import { formatEther } from "ethers";
import { Campaign, CAMPAIGN_STATUS_LABELS, CampaignStatus } from "../types/escrow";
import { getCampaignMetadata } from "../types/campaignMetadata";
import { formatEthToRupiah } from "../utils/currency";

interface CampaignCardProps {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onSelect }) => {
  const metadata = getCampaignMetadata(campaign.id);

  const targetEth = parseFloat(formatEther(campaign.fundingTarget));
  const raisedEth = parseFloat(formatEther(campaign.totalRaised));
  const percent = targetEth > 0 ? Math.min(100, Math.round((raisedEth / targetEth) * 100)) : 0;

  const nowEpoch = Math.floor(Date.now() / 1000);
  const deadlineEpoch = Number(campaign.fundingDeadline);
  const remainingSeconds = Math.max(0, deadlineEpoch - nowEpoch);
  const remainingDays = Math.ceil(remainingSeconds / (24 * 3600));

  const statusInfo = CAMPAIGN_STATUS_LABELS[campaign.status] || {
    label: "Status Tidak Diketahui",
    colorClass: "badge-funding",
  };

  return (
    <article className="campaign-card" onClick={() => onSelect(campaign)}>
      {/* Banner Foto */}
      <img
        src={metadata.imageUrl}
        alt={metadata.title}
        className="card-banner-img"
        loading="lazy"
      />

      <div className="card-body">
        {/* Kategori & Status */}
        <div className="card-category-row">
          <span className="category-tag">{metadata.category}</span>
          <span className={`badge ${statusInfo.colorClass}`}>{statusInfo.label}</span>
        </div>

        {/* Judul Kampanye */}
        <h3 className="card-title" title={metadata.title}>
          {metadata.title}
        </h3>

        {/* Info Penyelenggara dengan Centang Terverifikasi */}
        <div className="organizer-info-row">
          <span>{metadata.organizerName}</span>
          <svg className="verified-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        {/* Progress Donasi dalam Rupiah */}
        <div className="progress-section">
          <div className="progress-header">
            <div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", display: "block" }}>Terkumpul</span>
              <strong style={{ color: "var(--text-main)", fontSize: "0.95rem" }}>
                {formatEthToRupiah(campaign.totalRaised)}
              </strong>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", display: "block" }}>
                Target {formatEthToRupiah(campaign.fundingTarget)}
              </span>
              <strong style={{ color: "var(--color-primary)", fontSize: "0.95rem" }}>{percent}%</strong>
            </div>
          </div>

          <div className="progress-bar-bg" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>

          <div className="card-bottom-stats">
            <div>
              <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{campaign.milestoneCount}</span> Tahap Milestone
            </div>
            <div>
              {campaign.status === CampaignStatus.Funding ? (
                remainingDays > 0 ? (
                  <span>Sisa <strong>{remainingDays}</strong> hari</span>
                ) : (
                  <span style={{ color: "var(--color-rose)", fontWeight: 600 }}>Tenggat berakhir</span>
                )
              ) : (
                <span style={{ color: "var(--color-emerald)", fontWeight: 600 }}>Tahap Pelaksanaan</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
