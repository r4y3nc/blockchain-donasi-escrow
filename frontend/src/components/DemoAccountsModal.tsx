import React from "react";

interface DemoAccountsModalProps {
  onClose: () => void;
}

export const DemoAccountsModal: React.FC<DemoAccountsModalProps> = ({ onClose }) => {
  const accounts = [
    {
      role: "Regulator (Admin Tertinggi)",
      address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      desc: "Menyetujui pendaftaran yayasan/organizer, menyetujui verifikator, menyelesaikan sengketa, dan kontrol darurat pause.",
      badgeClass: "role-regulator",
    },
    {
      role: "Penyelenggara (Yayasan / Organizer)",
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      desc: "Membuka kampanye penggalangan dana baru dan mencairkan biaya operasional setelah milestone selesai.",
      badgeClass: "role-organizer",
    },
    {
      role: "Verifikator Independen (Auditor)",
      address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      desc: "Memeriksa dokumen laporan pengerjaan lapangan, menyetujui atau menolak milestone secara objektif.",
      badgeClass: "role-verifier",
    },
    {
      role: "Pelaksana Lapangan (Executor)",
      address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      desc: "Mengunggah bukti pencapaian milestone dan mencairkan dana proyek bersih untuk pelaksanaan kegiatan.",
      badgeClass: "badge-active",
    },
    {
      role: "Donatur Publik (Masyarakat)",
      address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4df",
      desc: "Dapat menyumbang ke kampanye mana pun, berhak refund jika target gagal, dan berhak membuka sengketa jika donasi mencapai 5%.",
      badgeClass: "badge-funding",
    },
  ];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="demo-accounts-title">
      <div className="modal-dialog" style={{ maxWidth: "600px" }}>
        <div className="modal-header">
          <div>
            <h2 id="demo-accounts-title" className="modal-title">
              Panduan Peran Akun Simulasi
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
              Gunakan private key bawaan dari terminal <code>npm run node</code> untuk beralih peran di MetaMask.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-close" aria-label="Tutup panduan">
            &times;
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", margin: "1rem 0" }}>
          {accounts.map((acc, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "0.85rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                <strong style={{ fontSize: "0.92rem", color: "var(--text-main)" }}>{acc.role}</strong>
                <span className={`role-pill ${acc.badgeClass}`}>{acc.role.split(" ")[0]}</span>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--color-primary)", backgroundColor: "rgba(0,0,0,0.06)", padding: "0.25rem 0.5rem", borderRadius: "var(--radius-sm)", wordBreak: "break-all", marginBottom: "0.4rem" }}>
                {acc.address}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{acc.desc}</div>
            </div>
          ))}
        </div>

        <button type="button" onClick={onClose} className="btn-secondary" style={{ width: "100%" }}>
          Mengerti & Tutup Panduan
        </button>
      </div>
    </div>
  );
};
