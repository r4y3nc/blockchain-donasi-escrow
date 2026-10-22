import { useState, useCallback, useEffect } from "react";
import { parseEther, JsonRpcProvider } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { getEscrowContract, parseContractError } from "../contract/contractConfig";
import { Campaign, Milestone, TransactionState, CampaignWindows } from "../types/escrow";

// Fallback public RPC provider untuk membaca data ketika wallet belum terhubung
const FALLBACK_RPC = "http://127.0.0.1:8545";

export function useEscrow() {
  const { provider, signer, account, refreshAccountData } = useWeb3();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [userContributions, setUserContributions] = useState<Record<number, { amount: bigint; refunded: boolean; disputeUsed: boolean }>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [txState, setTxState] = useState<TransactionState>({
    status: "idle",
  });

  const getReadProvider = useCallback(() => {
    if (provider) return provider;
    return new JsonRpcProvider(FALLBACK_RPC);
  }, [provider]);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const readProvider = getReadProvider();
      const contract = getEscrowContract(readProvider);

      const countBig = await contract.campaignCount();
      const count = Number(countBig);

      if (count === 0) {
        setCampaigns([]);
        setIsLoading(false);
        return;
      }

      const campaignList: Campaign[] = [];
      const contribMap: Record<number, { amount: bigint; refunded: boolean; disputeUsed: boolean }> = {};

      for (let id = 1; id <= count; id++) {
        try {
          const raw = await contract.getCampaign(id);
          const milestoneCount = Number(raw.milestoneCount);

          // Ambil milestones
          const milestones: Milestone[] = [];
          for (let m = 0; m < milestoneCount; m++) {
            const mRaw = await contract.getMilestone(id, m);
            milestones.push({
              index: m,
              status: Number(mRaw.status),
              shareBps: Number(mRaw.shareBps),
              submittedAt: mRaw.submittedAt,
              approvedAt: mRaw.approvedAt,
              evidenceHash: mRaw.evidenceHash,
            });
          }

          // Ambil windows
          let windows: CampaignWindows | undefined;
          try {
            const wRaw = await contract.campaignWindows(id);
            windows = {
              verification: wRaw.verification,
              challenge: wRaw.challenge,
            };
          } catch {
            // Jika versi awal kontrak
          }

          campaignList.push({
            id,
            organizer: raw.organizer,
            status: Number(raw.status),
            opCostBps: Number(raw.opCostBps),
            milestoneCount,
            fundingDeadline: raw.fundingDeadline,
            verifier: raw.verifier,
            executor: raw.executor,
            metadataHash: raw.metadataHash,
            fundingTarget: raw.fundingTarget,
            totalRaised: raw.totalRaised,
            releasedGross: raw.releasedGross,
            milestones,
            windows,
          });

          // Jika ada akun terhubung, cek kontribusi pengguna
          if (account) {
            const [cAmount, isRefunded, isDisputeUsed] = await Promise.all([
              contract.contributions(id, account).catch(() => 0n),
              contract.refunded(id, account).catch(() => false),
              contract.disputeUsed(id, account).catch(() => false),
            ]);
            contribMap[id] = {
              amount: cAmount,
              refunded: isRefunded,
              disputeUsed: isDisputeUsed,
            };
          }
        } catch (itemErr) {
          console.error(`Gagal memuat kampanye #${id}:`, itemErr);
        }
      }

      setCampaigns(campaignList);
      setUserContributions(contribMap);
    } catch (err: any) {
      console.error("Gagal memuat data kampanye:", err);
      setLoadError("Tidak dapat terhubung ke blockchain lokal (http://127.0.0.1:8545). Pastikan perintah 'npm run node' aktif di terminal.");
    } finally {
      setIsLoading(false);
    }
  }, [account, getReadProvider]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Helper untuk eksekusi transaksi
  const executeTx = async (title: string, txAction: () => Promise<any>) => {
    if (!signer) {
      setTxState({
        status: "failed",
        actionTitle: title,
        errorMessage: "Harap hubungkan dompet Web3 Anda terlebih dahulu.",
      });
      return false;
    }

    setTxState({
      status: "awaiting_wallet",
      actionTitle: title,
    });

    try {
      const tx = await txAction();
      setTxState({
        status: "broadcasting",
        actionTitle: title,
        hash: tx.hash,
      });

      const receipt = await tx.wait();
      if (receipt.status === 1) {
        setTxState({
          status: "confirmed",
          actionTitle: title,
          hash: tx.hash,
        });
        await fetchCampaigns();
        await refreshAccountData();
        return true;
      } else {
        throw new Error("Transaksi dibatalkan oleh jaringan.");
      }
    } catch (err: any) {
      console.error(`Transaksi '${title}' gagal:`, err);
      const friendlyMsg = parseContractError(err);
      setTxState({
        status: "failed",
        actionTitle: title,
        errorMessage: friendlyMsg,
      });
      return false;
    }
  };

  const donate = async (campaignId: number, amountEth: string) => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx(`Kirim Donasi Kampanye #${campaignId}`, () =>
      contract.donate(campaignId, { value: parseEther(amountEth) })
    );
  };

  const finalizeFunding = async (campaignId: number) => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx(`Finalisasi Pendanaan Kampanye #${campaignId}`, () =>
      contract.finalizeFunding(campaignId)
    );
  };

  const submitEvidence = async (campaignId: number, milestoneIndex: number, evidenceHash: string) => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx(`Unggah Bukti Milestone #${milestoneIndex + 1}`, () =>
      contract.submitEvidence(campaignId, milestoneIndex, evidenceHash)
    );
  };

  const approveMilestone = async (campaignId: number, milestoneIndex: number) => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx(`Setujui Milestone #${milestoneIndex + 1}`, () =>
      contract.approveMilestone(campaignId, milestoneIndex)
    );
  };

  const rejectMilestone = async (campaignId: number, milestoneIndex: number, reasonCode: number) => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx(`Tolak Milestone #${milestoneIndex + 1}`, () =>
      contract.rejectMilestone(campaignId, milestoneIndex, reasonCode)
    );
  };

  const escalate = async (campaignId: number, milestoneIndex: number) => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx(`Eskalasi Milestone #${milestoneIndex + 1}`, () =>
      contract.escalate(campaignId, milestoneIndex)
    );
  };

  const release = async (campaignId: number, milestoneIndex: number) => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx(`Cairkan Dana Milestone #${milestoneIndex + 1}`, () =>
      contract.release(campaignId, milestoneIndex)
    );
  };

  const refund = async (campaignId: number) => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx(`Klaim Pengembalian Dana Kampanye #${campaignId}`, () =>
      contract.refund(campaignId)
    );
  };

  const withdraw = async () => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx("Tarik Saldo Klaim (Withdraw)", () => contract.withdraw());
  };

  const openDispute = async (campaignId: number) => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx(`Buka Sengketa Kampanye #${campaignId}`, () =>
      contract.openDispute(campaignId)
    );
  };

  const createCampaign = async (
    metadataHash: string,
    fundingTargetEth: string,
    fundingDeadlineEpoch: number,
    opCostBps: number,
    verifier: string,
    executor: string,
    sharesBps: number[]
  ) => {
    if (!signer) return false;
    const contract = getEscrowContract(signer);
    return executeTx("Buat Penggalangan Dana Baru", () =>
      contract.createCampaign(
        metadataHash,
        parseEther(fundingTargetEth),
        fundingDeadlineEpoch,
        opCostBps,
        verifier,
        executor,
        sharesBps
      )
    );
  };

  const closeTxModal = () => {
    setTxState({ status: "idle" });
  };

  return {
    campaigns,
    userContributions,
    isLoading,
    loadError,
    txState,
    fetchCampaigns,
    closeTxModal,
    donate,
    finalizeFunding,
    submitEvidence,
    approveMilestone,
    rejectMilestone,
    escalate,
    release,
    refund,
    withdraw,
    openDispute,
    createCampaign,
  };
}
