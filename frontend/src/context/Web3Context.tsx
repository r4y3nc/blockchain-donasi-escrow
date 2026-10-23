import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { BrowserProvider, JsonRpcProvider, JsonRpcSigner, formatEther, ContractRunner } from "ethers";
import { EXPECTED_CHAIN_ID, getEscrowContract } from "../contract/contractConfig";
import { UserRoleInfo } from "../types/escrow";

export const LOCAL_RPC_URL = "http://127.0.0.1:8545";

export interface SimulatedAccount {
  name: string;
  role: string;
  address: string;
  desc: string;
  badgeClass: string;
}

export const DEMO_ACCOUNTS: SimulatedAccount[] = [
  {
    name: "Yayasan Peduli (Penyelenggara)",
    role: "Organizer",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Signer #1 (Approved Organizer)
    desc: "Akun resmi yayasan untuk membuka penggalangan donasi baru dan mencairkan biaya operasional.",
    badgeClass: "role-organizer",
  },
  {
    name: "Donatur Publik (Masyarakat)",
    role: "Donatur",
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", // Signer #5
    desc: "Akun masyarakat untuk mencoba berdonasi, doa donatur, refund, dan membuka sengketa.",
    badgeClass: "badge-funding",
  },
  {
    name: "Lembaga Audit (Verifikator)",
    role: "Verifier",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Signer #2 (Approved Verifier)
    desc: "Akun independen untuk memeriksa dan menyetujui atau menolak bukti milestone.",
    badgeClass: "role-verifier",
  },
  {
    name: "Kontraktor Tim Medis (Pelaksana)",
    role: "Executor",
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // Signer #4
    desc: "Akun pelaksana lapangan untuk mengunggah bukti milestone dan mencairkan anggaran.",
    badgeClass: "badge-active",
  },
  {
    name: "Dewan Pengawas (Regulator)",
    role: "Regulator",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Signer #0
    desc: "Otoritas tertinggi perizinan yayasan, darurat, dan penyelesaian sengketa.",
    badgeClass: "role-regulator",
  },
];


interface Web3ContextValue {
  account: string | null;
  chainId: bigint | null;
  isCorrectNetwork: boolean;
  balance: string;
  isConnecting: boolean;
  error: string | null;
  isMetaMaskAvailable: boolean;
  isConnectModalOpen: boolean;
  provider: ContractRunner | null;
  signer: JsonRpcSigner | null;
  userRole: UserRoleInfo;
  openConnectModal: () => void;
  closeConnectModal: () => void;
  connectMetaMask: () => Promise<void>;
  connectSimulatedAccount: (accountAddress: string) => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: () => Promise<void>;
  refreshAccountData: () => Promise<void>;
}

const defaultRoleInfo: UserRoleInfo = {
  isRegulator: false,
  isOrganizer: false,
  isVerifier: false,
  isExecutor: false,
  isDonor: false,
  claimableBalance: 0n,
};

const Web3Context = createContext<Web3ContextValue | undefined>(undefined);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [provider, setProvider] = useState<ContractRunner | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [userRole, setUserRole] = useState<UserRoleInfo>(defaultRoleInfo);

  const eth = typeof window !== "undefined" ? (window as any).ethereum : null;
  const isMetaMaskAvailable = !!eth;

  const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID;

  const refreshAccountData = useCallback(async () => {
    if (!account) {
      setUserRole(defaultRoleInfo);
      return;
    }

    try {
      // Gunakan RPC local jika provider browser belum ada
      const rpcProvider = new JsonRpcProvider(LOCAL_RPC_URL);
      const bal = await rpcProvider.getBalance(account);
      setBalance(parseFloat(formatEther(bal)).toFixed(4));

      // Baca peran dari smart contract
      const contract = getEscrowContract(rpcProvider);
      const [regulatorAddr, isOrg, isVer, claimable] = await Promise.all([
        contract.regulator().catch(() => ""),
        contract.approvedOrganizers(account).catch(() => false),
        contract.approvedVerifiers(account).catch(() => false),
        contract.claimable(account).catch(() => 0n),
      ]);

      const isReg = regulatorAddr.toLowerCase() === account.toLowerCase();

      // Cek apakah akun adalah Pelaksana (Executor) di demo accounts atau di kampanye on-chain
      let isExec = DEMO_ACCOUNTS.some(
        (demo) => demo.role === "Executor" && demo.address.toLowerCase() === account.toLowerCase()
      );

      if (!isExec) {
        try {
          const count = await contract.campaignCount();
          for (let i = 1; i <= Math.min(Number(count), 25); i++) {
            const camp = await contract.campaigns(i);
            if (camp.executor && camp.executor.toLowerCase() === account.toLowerCase()) {
              isExec = true;
              break;
            }
          }
        } catch {
          // Abaikan kesalahan pembacaan loop kampanye
        }
      }

      setUserRole({
        isRegulator: isReg,
        isOrganizer: isOrg,
        isVerifier: isVer,
        isExecutor: isExec,
        isDonor: !isReg && !isOrg && !isVer && !isExec,
        claimableBalance: claimable,
      });
    } catch (err: any) {
      console.error("Gagal memperbarui data akun:", err);
    }
  }, [account]);

  const connectMetaMask = async () => {
    setError(null);
    if (!eth) {
      setError("Ekstensi Web3 (seperti MetaMask) tidak ditemukan di browser Anda. Anda dapat memilih salah satu Akun Simulasi di bawah untuk langsung mencoba aplikasi.");
      return;
    }

    setIsConnecting(true);
    try {
      const bProvider = new BrowserProvider(eth);
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        const currentAccount = accounts[0];
        const currentSigner = await bProvider.getSigner();
        const network = await bProvider.getNetwork();

        setAccount(currentAccount);
        setProvider(bProvider);
        setSigner(currentSigner);
        setChainId(network.chainId);
        setIsConnectModalOpen(false);
      }
    } catch (err: any) {
      if (err.code === 4001) {
        setError("Koneksi dibatalkan oleh pengguna di MetaMask.");
      } else {
        setError(err.message || "Gagal menghubungkan MetaMask.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const connectSimulatedAccount = async (accountAddress: string) => {
    setError(null);
    setIsConnecting(true);
    try {
      const jsonProvider = new JsonRpcProvider(LOCAL_RPC_URL);
      const simSigner = await jsonProvider.getSigner(accountAddress);
      const network = await jsonProvider.getNetwork();

      setAccount(accountAddress);
      setProvider(jsonProvider);
      setSigner(simSigner);
      setChainId(network.chainId);
      setIsConnectModalOpen(false);
    } catch (err: any) {
      console.error("Gagal menghubungkan akun simulasi:", err);
      setError("Gagal menghubungi node blockchain lokal (http://127.0.0.1:8545). Pastikan perintah 'npm run node' aktif di terminal.");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setBalance("0");
    setUserRole(defaultRoleInfo);
  };

  const switchNetwork = async () => {
    if (!eth) return;
    const chainIdHex = "0x" + EXPECTED_CHAIN_ID.toString(16);
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainIdHex,
                chainName: "Hardhat Localhost",
                rpcUrls: [LOCAL_RPC_URL],
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              },
            ],
          });
        } catch (addError) {
          console.error("Gagal menambahkan jaringan localhost:", addError);
        }
      }
    }
  };

  useEffect(() => {
    if (!eth) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      } else {
        disconnectWallet();
      }
    };

    const handleChainChanged = (newChainId: string) => {
      setChainId(BigInt(newChainId));
    };

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);

    eth
      .request({ method: "eth_accounts" })
      .then(async (accounts: string[]) => {
        if (accounts.length > 0) {
          const bProvider = new BrowserProvider(eth);
          const currentSigner = await bProvider.getSigner();
          const network = await bProvider.getNetwork();
          setAccount(accounts[0]);
          setProvider(bProvider);
          setSigner(currentSigner);
          setChainId(network.chainId);
        }
      })
      .catch(() => {});

    return () => {
      eth.removeListener("accountsChanged", handleAccountsChanged);
      eth.removeListener("chainChanged", handleChainChanged);
    };
  }, [eth]);

  useEffect(() => {
    if (account) {
      refreshAccountData();
    }
  }, [account, chainId, refreshAccountData]);

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        isCorrectNetwork,
        balance,
        isConnecting,
        error,
        isMetaMaskAvailable,
        isConnectModalOpen,
        provider,
        signer,
        userRole,
        openConnectModal: () => setIsConnectModalOpen(true),
        closeConnectModal: () => {
          setIsConnectModalOpen(false);
          setError(null);
        },
        connectMetaMask,
        connectSimulatedAccount,
        disconnectWallet,
        switchNetwork,
        refreshAccountData,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 harus digunakan di dalam Web3Provider");
  }
  return context;
};
