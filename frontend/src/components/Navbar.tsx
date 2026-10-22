import React from "react";
import { useWeb3 } from "../context/Web3Context";
import { formatEthToRupiah } from "../utils/currency";

interface NavbarProps {
  onOpenDemoGuide: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenCreateCampaign?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenDemoGuide,
  theme,
  onToggleTheme,
  onOpenCreateCampaign,
}) => {
  const {
    account,
    balance,
    isCorrectNetwork,
    isConnecting,
    userRole,
    openConnectModal,
    disconnectWallet,
    switchNetwork,
  } = useWeb3();

  const shortAddress = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : "";

  return (
    <header className="header-nav">
      <div className="container header-content">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div className="brand-title">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>AmanahBisa</span>
            <span className="brand-badge">Rupiah Escrow</span>
          </div>
        </div>

        <div className="nav-actions">
          {/* Tombol Buat Kampanye khusus Penyelenggara Resmi */}
          {account && userRole.isOrganizer && onOpenCreateCampaign && (
            <button
              type="button"
              onClick={onOpenCreateCampaign}
              className="btn-primary"
              style={{
                minHeight: "38px",
                padding: "0.35rem 0.85rem",
                fontSize: "0.85rem",
                gap: "0.35rem",
                boxShadow: "0 2px 8px rgba(13, 148, 136, 0.35)",
              }}
              title="Buka penggalangan dana baru sebagai Penyelenggara Resmi"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>+ Buat Kampanye</span>
            </button>
          )}

          {/* Tombol Panduan Akun Uji */}
          <button
            type="button"
            onClick={onOpenDemoGuide}
            className="btn-secondary"
            style={{ minHeight: "38px", padding: "0.3rem 0.75rem", fontSize: "0.8rem" }}
            title="Lihat daftar akun simulasi peranan"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Akun Simulasi</span>
          </button>

          {/* Toggle Tema Light/Dark (R-21, R-34) */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="btn-secondary"
            style={{ minHeight: "38px", minWidth: "38px", padding: "0.3rem", borderRadius: "50%" }}
            aria-label="Ganti tema tampilan"
            title={theme === "light" ? "Ganti ke mode gelap" : "Ganti ke mode terang"}
          >
            {theme === "light" ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>

          {/* Status Jaringan */}
          {account && (
            <div className="network-badge">
              <span className={`network-dot ${isCorrectNetwork ? "dot-green" : "dot-red"}`} />
              <span>{isCorrectNetwork ? "Hardhat (31337)" : "Salah Jaringan"}</span>
              {!isCorrectNetwork && (
                <button
                  type="button"
                  onClick={switchNetwork}
                  className="btn-outline-danger"
                  style={{ minHeight: "30px", padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                >
                  Pindah ke Localhost
                </button>
              )}
            </div>
          )}

          {/* Lencana Peran Akun */}
          {account && (
            <>
              {userRole.isRegulator && <span className="role-pill role-regulator">Regulator</span>}
              {userRole.isOrganizer && <span className="role-pill role-organizer">Penyelenggara</span>}
              {userRole.isVerifier && <span className="role-pill role-verifier">Verifikator</span>}
            </>
          )}

          {/* Tombol Dompet dengan Saldo Rupiah */}
          {account ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <div
                style={{
                  backgroundColor: "var(--bg-surface)",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.85rem",
                  textAlign: "right",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                  {formatEthToRupiah(balance)}
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: "0.72rem", fontFamily: "monospace" }}>
                  {shortAddress} ({balance} ETH)
                </div>
              </div>
              <button
                type="button"
                onClick={disconnectWallet}
                className="btn-secondary"
                style={{ minHeight: "40px", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
                title="Putuskan sambungan dompet"
              >
                Keluar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openConnectModal}
              disabled={isConnecting}
              className="btn-primary"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M22 10h-4a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h4" />
                <circle cx="18" cy="12" r="1" />
              </svg>
              <span>{isConnecting ? "Menghubungkan..." : "Hubungkan Dompet"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
