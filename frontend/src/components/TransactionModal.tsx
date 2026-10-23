import React from "react";
import { TransactionState } from "../types/escrow";

interface TransactionModalProps {
  txState: TransactionState;
  onClose: () => void;
  onFastForwardTime?: (seconds?: number) => Promise<boolean>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ txState, onClose, onFastForwardTime }) => {
  if (txState.status === "idle") return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tx-modal-title">
      <div className="modal-dialog" style={{ textAlign: "center", maxWidth: "480px" }}>
        {/* Status: Menunggu Konfirmasi Dompet */}
        {txState.status === "awaiting_wallet" && (
          <div>
            <div className="spinner" style={{ width: "48px", height: "48px" }} />
            <h3 id="tx-modal-title" className="modal-title" style={{ marginTop: "1rem" }}>
              Konfirmasi di Dompet Anda
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: "0.75rem 0 1.5rem" }}>
              Harap setujui permintaan transaksi <strong>{txState.actionTitle}</strong> pada ekstensi dompet Web3 Anda.
            </p>
          </div>
        )}

        {/* Status: Transaksi Sedang Diproses */}
        {txState.status === "broadcasting" && (
          <div>
            <div className="spinner" style={{ width: "48px", height: "48px", borderColor: "rgba(56, 189, 248, 0.2)", borderTopColor: "var(--color-blue)" }} />
            <h3 id="tx-modal-title" className="modal-title" style={{ marginTop: "1rem" }}>
              Memproses Transaksi di Blockchain
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: "0.75rem 0 1rem" }}>
              Transaksi Anda telah dikirim dan sedang menunggu konfirmasi blok jaringan.
            </p>
            {txState.hash && (
              <div style={{ backgroundColor: "var(--bg-surface)", padding: "0.6rem", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", wordBreak: "break-all", fontFamily: "monospace", color: "var(--text-muted)" }}>
                Hash: {txState.hash}
              </div>
            )}
          </div>
        )}

        {/* Status: Sukses Dikonfirmasi */}
        {txState.status === "confirmed" && (
          <div>
            <div style={{ width: "56px", height: "56px", backgroundColor: "var(--color-emerald-bg)", border: "2px solid var(--color-emerald)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 id="tx-modal-title" className="modal-title">
              Transaksi Berhasil
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: "0.75rem 0 1rem" }}>
              Aksi <strong>{txState.actionTitle}</strong> berhasil dicatat di blockchain.
            </p>
            {txState.hash && (
              <div style={{ backgroundColor: "var(--bg-surface)", padding: "0.6rem", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", wordBreak: "break-all", fontFamily: "monospace", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                Tx: {txState.hash}
              </div>
            )}
            <button type="button" onClick={onClose} className="btn-primary" style={{ width: "100%" }}>
              Selesai & Tutup
            </button>
          </div>
        )}

        {/* Status: Gagal */}
        {txState.status === "failed" && (
          <div>
            <div style={{ width: "56px", height: "56px", backgroundColor: "var(--color-rose-bg)", border: "2px solid var(--color-rose)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h3 id="tx-modal-title" className="modal-title" style={{ color: "var(--color-rose)" }}>
              Transaksi Ditolak / Gagal
            </h3>
            <p style={{ color: "var(--text-main)", fontSize: "0.9rem", margin: "0.75rem 0 1rem", backgroundColor: "var(--bg-surface)", padding: "0.85rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", textAlign: "left" }}>
              {txState.errorMessage || "Panggilan smart contract dibatalkan oleh jaringan."}
            </p>

            {onFastForwardTime && (txState.errorMessage?.toLowerCase().includes("sanggahan") || txState.errorMessage?.toLowerCase().includes("challenge")) && (
              <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0.85rem", marginBottom: "1rem", textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)", marginBottom: "0.25rem" }}>
                  💡 Fitur Keamanan Smart Contract (Challenge Window):
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.75rem", lineHeight: 1.5 }}>
                  Setelah verifikator menyetujui bukti, smart contract memberlakukan masa tunggu 2 hari agar donatur dapat menyanggah jika ada kejanggalan sebelum dana cair ke pelaksana.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await onFastForwardTime();
                    if (ok) {
                      onClose();
                    }
                  }}
                  className="btn-teal"
                  style={{ width: "100%", fontSize: "0.82rem", fontWeight: 700, minHeight: "36px" }}
                >
                  ⏩ Majukan Waktu Node 2 Hari & Siap Cairkan
                </button>
              </div>
            )}

            <button type="button" onClick={onClose} className="btn-secondary" style={{ width: "100%" }}>
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
