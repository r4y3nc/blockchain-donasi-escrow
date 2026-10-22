import React, { useState } from "react";
import { formatEther } from "ethers";
import { Campaign } from "../types/escrow";
import { useWeb3 } from "../context/Web3Context";
import { getCampaignMetadata } from "../types/campaignMetadata";
import {
  formatRupiah,
  formatEthToRupiah,
  idrToEth,
  parseRupiahInput,
  ETH_TO_IDR_RATE,
} from "../utils/currency";

interface DonateModalProps {
  campaign: Campaign;
  onClose: () => void;
  onDonate: (campaignId: number, amountEth: string, donorName?: string, prayer?: string) => Promise<boolean>;
}

export const DonateModal: React.FC<DonateModalProps> = ({ campaign, onClose, onDonate }) => {
  const { account, balance, isCorrectNetwork, openConnectModal } = useWeb3();

  // Nominal default donasi Rp 100.000
  const [rupiahAmount, setRupiahAmount] = useState<number>(100000);
  const [donorName, setDonorName] = useState<string>("");
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [prayerText, setPrayerText] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const metadata = getCampaignMetadata(campaign.id);

  const targetEth = parseFloat(formatEther(campaign.fundingTarget));
  const raisedEth = parseFloat(formatEther(campaign.totalRaised));
  const remainingEth = Math.max(0, targetEth - raisedEth);

  const ethEquivalent = idrToEth(rupiahAmount);
  const userBalanceEth = parseFloat(balance) || 0;
  const userBalanceIdr = Math.round(userBalanceEth * ETH_TO_IDR_RATE);

  const opCostIdr = Math.round((rupiahAmount * campaign.opCostBps) / 10000);
  const netProjectIdr = Math.max(0, rupiahAmount - opCostIdr);

  const handleDonateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (rupiahAmount < 10000) {
      setValidationError("Nominal donasi minimal adalah Rp 10.000.");
      return;
    }

    if (userBalanceIdr < rupiahAmount) {
      setValidationError(
        `Saldo dompet Anda (${formatRupiah(userBalanceIdr)}) tidak mencukupi untuk donasi ini.`
      );
      return;
    }

    const finalName = isAnonymous ? "Hamba Allah" : donorName.trim() || "Donatur Baik";
    const success = await onDonate(campaign.id, ethEquivalent, finalName, prayerText.trim());
    if (success) {
      onClose();
    }
  };

  const presetOptions = [25000, 50000, 100000, 250000, 500000, 1000000];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="donate-modal-title">
      <div className="modal-dialog" style={{ maxWidth: "520px" }}>
        <div className="modal-header">
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase" }}>
              {metadata.category}
            </span>
            <h2 id="donate-modal-title" className="modal-title" style={{ marginTop: "0.2rem" }}>
              Donasi Sekarang
            </h2>
          </div>
          <button type="button" onClick={onClose} className="btn-close" aria-label="Tutup form donasi">
            &times;
          </button>
        </div>

        <form onSubmit={handleDonateSubmit}>
          {/* Info Ringkas Kampanye */}
          <div style={{ backgroundColor: "var(--bg-surface)", padding: "0.85rem 1rem", borderRadius: "var(--radius-md)", marginBottom: "1.25rem", fontSize: "0.85rem" }}>
            <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: "0.3rem" }}>
              {metadata.title}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
              <span>Terkumpul: <strong>{formatEthToRupiah(campaign.totalRaised)}</strong></span>
              <span>Kekurangan: <strong style={{ color: "var(--color-primary)" }}>{formatEthToRupiah(remainingEth)}</strong></span>
            </div>
          </div>

          {/* Pilihan Nominal Cepat Rupiah */}
          <div className="form-group">
            <label className="form-label">Pilih Nominal Donasi Cepat</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {presetOptions.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRupiahAmount(preset)}
                  className={`btn-secondary ${rupiahAmount === preset ? "btn-primary" : ""}`}
                  style={{ minHeight: "42px", padding: "0.3rem 0.5rem", fontSize: "0.85rem", fontWeight: 700 }}
                >
                  {formatRupiah(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* Input Nominal Bebas Rupiah */}
          <div className="form-group">
            <label htmlFor="donation-amount" className="form-label">
              Nominal Donasi Lainnya (Rp)
            </label>
            <input
              id="donation-amount"
              type="text"
              value={rupiahAmount ? rupiahAmount.toLocaleString("id-ID") : ""}
              onChange={(e) => setRupiahAmount(parseRupiahInput(e.target.value))}
              placeholder="Masukkan nominal Rupiah"
              className="form-input"
              required
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "0.4rem" }}>
              <span>Setara ~{ethEquivalent} ETH di blockchain</span>
              <span>Saldo: {formatEthToRupiah(balance)}</span>
            </div>
          </div>

          {/* Nama Donatur & Opsi Anonim */}
          <div className="form-group">
            <label htmlFor="donor-name" className="form-label">
              Nama Donatur (Opsional)
            </label>
            <input
              id="donor-name"
              type="text"
              placeholder="Contoh: Budi Santoso"
              disabled={isAnonymous}
              value={isAnonymous ? "Hamba Allah" : donorName}
              onChange={(e) => setDonorName(e.target.value)}
              className="form-input"
            />
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <input
                id="anon-check"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)" }}
              />
              <label htmlFor="anon-check" style={{ cursor: "pointer", color: "var(--text-muted)" }}>
                Sembunyikan nama saya (Donasi sebagai Hamba Allah)
              </label>
            </div>
          </div>

          {/* Pesan Kebaikan / Doa */}
          <div className="form-group">
            <label htmlFor="donor-prayer" className="form-label">
              Tuliskan Doa atau Pesan Kebaikan (Opsional)
            </label>
            <textarea
              id="donor-prayer"
              rows={2}
              placeholder="Semoga membawa manfaat dan berkah bagi semua..."
              value={prayerText}
              onChange={(e) => setPrayerText(e.target.value)}
              className="form-input"
              style={{ minHeight: "68px", resize: "vertical" }}
            />
          </div>

          {/* Rincian Transparansi Alokasi Escrow dalam Rupiah */}
          {rupiahAmount > 0 && (
            <div style={{ backgroundColor: "rgba(2, 132, 199, 0.06)", border: "1px solid rgba(2, 132, 199, 0.2)", borderRadius: "var(--radius-md)", padding: "0.85rem 1rem", marginBottom: "1.25rem", fontSize: "0.82rem" }}>
              <div style={{ fontWeight: 700, color: "var(--color-primary)", marginBottom: "0.4rem" }}>
                Rincian Transparansi Escrow:
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Total Donasi Anda:</span>
                <strong>{formatRupiah(rupiahAmount)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Terkunci di Smart Contract (Netto):</span>
                <span style={{ color: "var(--color-emerald)", fontWeight: 700 }}>
                  {formatRupiah(netProjectIdr)} ({(100 - campaign.opCostBps / 100).toFixed(1)}%)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Biaya Operasional Yayasan:</span>
                <span>{formatRupiah(opCostIdr)} ({(campaign.opCostBps / 100).toFixed(1)}%)</span>
              </div>
            </div>
          )}

          {validationError && (
            <div style={{ color: "var(--color-rose)", fontSize: "0.85rem", marginBottom: "1rem", backgroundColor: "var(--color-rose-bg)", padding: "0.6rem 0.8rem", borderRadius: "var(--radius-sm)" }}>
              {validationError}
            </div>
          )}

          {!account ? (
            <button
              type="button"
              onClick={openConnectModal}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              Hubungkan Dompet untuk Berdonasi
            </button>
          ) : !isCorrectNetwork ? (
            <div style={{ textAlign: "center", color: "var(--color-rose)", fontSize: "0.9rem" }}>
              Harap alihkan jaringan dompet ke Hardhat Localhost (31337) terlebih dahulu.
            </div>
          ) : (
            <button type="submit" className="btn-primary" style={{ width: "100%", fontSize: "1rem" }}>
              Lanjut Donasi ({formatRupiah(rupiahAmount)})
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
