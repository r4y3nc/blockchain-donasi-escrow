import React, { useState } from "react";
import { idrToEth, parseRupiahInput } from "../utils/currency";

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    title: string,
    category: "Pendidikan" | "Medis & Kesehatan" | "Bencana Alam" | "Panti Asuhan" | "Sarana Ibadah" | "Sosial",
    story: string,
    targetIdr: number,
    days: number,
    opCostPercent: number,
    verifier: string,
    executor: string,
    sharesBps: number[]
  ) => Promise<boolean>;
}

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, onCreate }) => {
  if (!isOpen) return null;
  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<"Pendidikan" | "Medis & Kesehatan" | "Bencana Alam" | "Panti Asuhan" | "Sarana Ibadah" | "Sosial">("Sosial");
  const [story, setStory] = useState<string>("");
  const [targetIdr, setTargetIdr] = useState<number>(50000000);
  const [days, setDays] = useState<number>(30);
  const [opCostPercent, setOpCostPercent] = useState<number>(5);

  // Verifikator terdaftar di smart contract
  const [verifier, setVerifier] = useState<string>("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  // Pelaksana terdaftar di smart contract
  const [executor, setExecutor] = useState<string>("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65");
  const [sharesInput, setSharesInput] = useState<string>("30, 30, 40");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError("Judul kampanye wajib diisi.");
      return;
    }

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
      setFormError(`Total porsi tahapan milestone harus tepat 100% (saat ini ${totalPercent}%).`);
      return;
    }

    const sharesBps = sharesArr.map((p) => Math.round(p * 100));

    setIsSubmitting(true);
    const ok = await onCreate(
      title.trim(),
      category,
      story.trim(),
      targetIdr,
      days,
      opCostPercent,
      verifier.trim(),
      executor.trim(),
      sharesBps
    );
    setIsSubmitting(false);

    if (ok) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-campaign-title">
      <div className="modal-dialog" style={{ maxWidth: "620px" }}>
        <div className="modal-header">
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase" }}>
              Panel Penyelenggara Resmi
            </span>
            <h2 id="create-campaign-title" className="modal-title" style={{ marginTop: "0.2rem" }}>
              Buat Penggalangan Donasi Baru
            </h2>
          </div>
          <button type="button" onClick={onClose} className="btn-close" aria-label="Tutup form">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Judul Kampanye */}
          <div className="form-group">
            <label className="form-label">Judul Program Donasi</label>
            <input
              type="text"
              placeholder="Contoh: Bantuan Sembako & Dapur Umum Korban Banjir"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Kategori */}
          <div className="form-group">
            <label className="form-label">Kategori Program</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="form-input"
            >
              <option value="Pendidikan">Pendidikan</option>
              <option value="Medis & Kesehatan">Medis & Kesehatan</option>
              <option value="Bencana Alam">Bencana Alam</option>
              <option value="Panti Asuhan">Panti Asuhan</option>
              <option value="Sarana Ibadah">Sarana Ibadah</option>
              <option value="Sosial">Sosial & Kemanusiaan</option>
            </select>
          </div>

          {/* Cerita & Latar Belakang */}
          <div className="form-group">
            <label className="form-label">Cerita / Latar Belakang Proyek</label>
            <textarea
              rows={3}
              placeholder="Jelaskan kebutuhan penerima manfaat dan mengapa bantuan ini sangat dibutuhkan..."
              value={story}
              onChange={(e) => setStory(e.target.value)}
              className="form-input"
              style={{ minHeight: "80px", resize: "vertical" }}
            />
          </div>

          {/* Target Dana & Tenggat */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Target Pendanaan (Rp)</label>
              <input
                type="text"
                value={targetIdr ? targetIdr.toLocaleString("id-ID") : ""}
                onChange={(e) => setTargetIdr(parseRupiahInput(e.target.value))}
                placeholder="50.000.000"
                className="form-input"
                required
              />
              <div className="form-hint">Setara ~{idrToEth(targetIdr)} ETH di smart contract</div>
            </div>

            <div className="form-group">
              <label className="form-label">Tenggat Waktu (Hari)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="form-input"
                required
              />
              <div className="form-hint">Maksimal 365 hari</div>
            </div>
          </div>

          {/* Biaya Operasional & Porsi Milestone */}
          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Biaya Operasional</label>
              <select
                value={opCostPercent}
                onChange={(e) => setOpCostPercent(Number(e.target.value))}
                className="form-input"
              >
                <option value={2}>2%</option>
                <option value={5}>5% (Standar)</option>
                <option value={10}>10% (Maksimal)</option>
              </select>
              <div className="form-hint">Dipotong bertahap per rilis</div>
            </div>

            <div className="form-group">
              <label className="form-label">Porsi Tahap Milestone (%)</label>
              <input
                type="text"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                className="form-input"
                placeholder="30, 30, 40"
                required
              />
              <div className="form-hint">Total wajib tepat 100%</div>
            </div>
          </div>

          {/* Pilihan Verifikator Resmi */}
          <div className="form-group">
            <label className="form-label">Pilih Verifikator Independen Terakreditasi</label>
            <select
              value={verifier}
              onChange={(e) => setVerifier(e.target.value)}
              className="form-input"
            >
              <option value="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC">
                Lembaga Audit 1 (0x3C44...93BC) - Terdaftar
              </option>
              <option value="0x90F79bf6EB2c4f870365E785982E1f101E93b906">
                Lembaga Audit 2 (0x90F7...b906) - Terdaftar
              </option>
            </select>
            <div className="form-hint">Pihak independen yang akan memverifikasi bukti kerja fisik</div>
          </div>

          {/* Pelaksana Lapangan */}
          <div className="form-group">
            <label className="form-label">Alamat Pelaksana Lapangan (Executor)</label>
            <input
              type="text"
              value={executor}
              onChange={(e) => setExecutor(e.target.value)}
              className="form-input"
              required
            />
            <div className="form-hint">Akun mitra pelaksana yang bertugas di lapangan</div>
          </div>

          {formError && (
            <div style={{ color: "var(--color-rose)", fontSize: "0.85rem", marginBottom: "1.25rem", backgroundColor: "var(--color-rose-bg)", padding: "0.6rem 0.8rem", borderRadius: "var(--radius-sm)" }}>
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ flex: 2, fontSize: "1rem" }}
            >
              {isSubmitting ? "Mendaftarkan ke Blockchain..." : "Buka Kampanye di Blockchain"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
