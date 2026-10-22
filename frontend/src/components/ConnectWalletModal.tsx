import React from "react";
import { useWeb3, DEMO_ACCOUNTS } from "../context/Web3Context";

export const ConnectWalletModal: React.FC = () => {
  const {
    isConnectModalOpen,
    closeConnectModal,
    isMetaMaskAvailable,
    isConnecting,
    error,
    connectMetaMask,
    connectSimulatedAccount,
  } = useWeb3();

  if (!isConnectModalOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="connect-modal-title">
      <div className="modal-dialog" style={{ maxWidth: "560px" }}>
        <div className="modal-header">
          <div>
            <h2 id="connect-modal-title" className="modal-title">
              Hubungkan ke Aplikasi
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
              Pilih metode koneksi dompet Web3 untuk mulai berdonasi atau mengelola escrow.
            </p>
          </div>
          <button type="button" onClick={closeConnectModal} className="btn-close" aria-label="Tutup pilihan koneksi">
            &times;
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: "var(--color-rose-bg)", color: "var(--color-rose)", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", marginBottom: "1.25rem", border: "1px solid rgba(244,63,94,0.3)" }}>
            {error}
          </div>
        )}

        {/* METODE 1: METAMASK */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "0.6rem", letterSpacing: "0.04em" }}>
            Metode 1: Ekstensi Dompet Browser
          </div>

          <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🦊</span>
                <div>
                  <strong style={{ fontSize: "0.95rem", color: "var(--text-main)" }}>MetaMask / Browser Web3</strong>
                  <div style={{ fontSize: "0.78rem", color: isMetaMaskAvailable ? "var(--color-emerald)" : "var(--color-rose)" }}>
                    {isMetaMaskAvailable ? "Terdeteksi pada browser Anda" : "Ekstensi belum terpasang"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={connectMetaMask}
                disabled={isConnecting}
                className="btn-primary"
                style={{ minHeight: "38px", padding: "0.3rem 0.9rem", fontSize: "0.85rem" }}
              >
                {isConnecting ? "Menghubungkan..." : "Buka MetaMask"}
              </button>
            </div>

            {!isMetaMaskAvailable && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0.5rem 0 0", lineHeight: 1.5 }}>
                Ekstensi MetaMask tidak ditemukan di browser ini. Jangan khawatir, Anda tetap bisa mencoba seluruh fitur aplikasi secara langsung menggunakan <strong>Akun Simulasi Instan</strong> di bawah tanpa perlu memasang ekstensi apa pun!
              </p>
            )}
          </div>
        </div>

        {/* METODE 2: AKUN SIMULASI LANGSUNG (INSTANT LOGIN) */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Metode 2: Masuk Instan Akun Simulasi Hardhat
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--color-teal)", fontWeight: 700 }}>Tanpa Pasang Ekstensi</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {DEMO_ACCOUNTS.map((acc, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem 1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                    <strong style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>{acc.name}</strong>
                    <span className={`role-pill ${acc.badgeClass}`}>{acc.role}</span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{acc.desc}</div>
                </div>

                <button
                  type="button"
                  onClick={() => connectSimulatedAccount(acc.address)}
                  disabled={isConnecting}
                  className="btn-secondary"
                  style={{ minHeight: "36px", padding: "0.3rem 0.8rem", fontSize: "0.82rem", whiteSpace: "nowrap" }}
                >
                  Pilih Akun Ini
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
