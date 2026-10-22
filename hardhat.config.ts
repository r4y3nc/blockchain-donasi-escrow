import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

// Konfigurasi minimal: hanya jaringan simulasi lokal (tanpa jaringan publik,
// tanpa kunci pribadi, tanpa variabel rahasia).
export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    version: "0.8.34",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    // Node lokal yang dijalankan dengan `npm run node`. Tanpa kunci pribadi:
    // akun uji disediakan oleh node itu sendiri.
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
  },
});
