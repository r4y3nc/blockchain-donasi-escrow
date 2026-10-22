import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.create();
const ETH = (n: string) => ethers.parseEther(n);
const DAY = 86400;
const H = ethers.keccak256(ethers.toUtf8Bytes("x"));
async function now() { return (await ethers.provider.getBlock("latest"))!.timestamp; }
async function advance(s: number) { await ethers.provider.send("evm_increaseTime", [s]); await ethers.provider.send("evm_mine", []); }
async function setup(deadlineIn = 30 * DAY) {
  const [regulator, organizer, verifier, executor, donorA, donorB] = await ethers.getSigners();
  const e = await ethers.deployContract("DonationEscrow", [regulator.address]);
  await e.connect(regulator).setOrganizerApproval(organizer.address, true);
  await e.connect(regulator).setVerifierApproval(verifier.address, true);
  await e.connect(organizer).createCampaign(H, ETH("1"), (await now()) + deadlineIn, 500, verifier.address, executor.address, [3000, 3000, 4000]);
  return { e, regulator, organizer, verifier, executor, donorA, donorB };
}
describe("PoC temuan audit", function () {
  it("PoC-A01: donatur ambang dapat membuka sengketa berulang setelah Regulator melanjutkan", async function () {
    const { e, regulator, verifier, executor, donorA, donorB } = await setup();
    await e.connect(donorA).donate(1n, { value: ETH("0.6") });
    await e.connect(donorB).donate(1n, { value: ETH("0.4") });
    await e.finalizeFunding(1n);
    for (let i = 0; i < 5; i++) {
      await e.connect(donorA).openDispute(1n);
      await e.connect(regulator).resolveDispute(1n, true, H);
    }
    expect((await e.getCampaign(1n)).status).to.equal(1n); // masih Active, tetapi 5 pembekuan berhasil tanpa biaya selain gas
  });
  it("PoC-A02: tenggat pendanaan sangat jauh mengunci dana donatur", async function () {
    const { e, organizer, donorA } = await setup(1000 * 365 * DAY);
    await e.connect(donorA).donate(1n, { value: ETH("0.5") });
    await advance(365 * DAY);
    await expect(e.connect(donorA).refund(1n)).to.be.rejected; // belum Failed
    await expect(e.finalizeFunding(1n)).to.be.rejected; // FundingStillOpen
  });
  it("PoC-A03: Regulator dapat memperpendek challenge window pada milestone yang sedang berjalan", async function () {
    const { e, regulator, verifier, executor, donorA, donorB } = await setup();
    await e.connect(donorA).donate(1n, { value: ETH("0.6") });
    await e.connect(donorB).donate(1n, { value: ETH("0.4") });
    await e.finalizeFunding(1n);
    await e.connect(executor).submitEvidence(1n, 0, H);
    await e.connect(verifier).approveMilestone(1n, 0);
    await expect(e.release(1n, 0)).to.be.rejected; // challenge window 2 hari masih berjalan
    await e.connect(regulator).setParams(1000, 7 * DAY, 1, 500); // jendela jadi 1 detik
    await advance(2);
    await e.release(1n, 0); // berhasil sebelum 2 hari
    expect((await e.getMilestone(1n, 0)).status).to.equal(5n);
  });
  it("PoC-A04: resolveDispute menerima decisionHash nol", async function () {
    const { e, regulator, donorA, donorB } = await setup();
    await e.connect(donorA).donate(1n, { value: ETH("0.6") });
    await e.connect(donorB).donate(1n, { value: ETH("0.4") });
    await e.finalizeFunding(1n);
    await e.connect(regulator).openDispute(1n);
    await e.connect(regulator).resolveDispute(1n, true, ethers.ZeroHash);
  });
  it("PoC-A05: jendela verifikasi tetap berjalan selama Disputed sehingga eskalasi dapat langsung dipanggil setelah sengketa", async function () {
    const { e, regulator, executor, verifier, donorA, donorB } = await setup();
    await e.connect(donorA).donate(1n, { value: ETH("0.6") });
    await e.connect(donorB).donate(1n, { value: ETH("0.4") });
    await e.finalizeFunding(1n);
    await e.connect(executor).submitEvidence(1n, 0, H);
    await e.connect(regulator).openDispute(1n);
    await advance(8 * DAY);
    await e.connect(regulator).resolveDispute(1n, true, H);
    await e.escalate(1n, 0); // langsung bisa dieskalasi, verifikator tidak sempat merespons
    expect((await e.getMilestone(1n, 0)).status).to.equal(4n);
  });
});
