import React from "react";
import { formatRupiah, ETH_TO_IDR_RATE } from "../utils/currency";

interface HeroProps {
  totalCampaigns: number;
  totalEthRaised: number;
  onExploreClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ totalCampaigns, totalEthRaised, onExploreClick }) => {
  const totalRupiah = totalEthRaised * ETH_TO_IDR_RATE;

  return (
    <section className="hero-section">
      <div className="container hero-grid">
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", backgroundColor: "var(--color-blue-bg)", color: "var(--color-primary)", padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.82rem", fontWeight: 700, marginBottom: "1rem" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Platform Donasi Escrow Terpercaya Indonesia</span>
          </div>

          <h1 className="hero-title">
            Gotong Royong Nyata, <span className="hero-highlight">Amanah & Transparan</span> Berbasis Escrow
          </h1>
          <p className="hero-subtitle">
            Donasi tidak langsung cair ke rekening pribadi penyelenggara. Dana tersimpan aman di dalam smart contract blockchain dan dicairkan per milestone setelah diverifikasi oleh verifikator independen.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <button type="button" onClick={onExploreClick} className="btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Donasi Sekarang</span>
            </button>
          </div>
        </div>

        {/* Kotak Transparansi Rupiah */}
        <div className="trust-summary-card">
          <div className="trust-card-header">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Akuntabilitas Donasi Transparan</span>
          </div>

          <div className="trust-stat-grid">
            <div className="trust-stat-box">
              <div className="trust-stat-label">Total Donasi Terkumpul</div>
              <div className="trust-stat-val" style={{ fontSize: "1.15rem" }}>
                {formatRupiah(totalRupiah)}
              </div>
            </div>
            <div className="trust-stat-box">
              <div className="trust-stat-label">Kampanye Terdaftar</div>
              <div className="trust-stat-val">{totalCampaigns} Proyek</div>
            </div>
          </div>

          <div style={{ backgroundColor: "var(--bg-surface)", padding: "0.85rem", borderRadius: "var(--radius-md)", fontSize: "0.82rem", color: "var(--text-muted)" }}>
            <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: "0.2rem" }}>
              Jaminan Perlindungan Donatur:
            </div>
            Jika penggalangan tidak mencapai target, atau proyek dibatalkan, smart contract menjamin hak pengembalian dana donasi Anda secara utuh atau proporsional.
          </div>
        </div>
      </div>
    </section>
  );
};
