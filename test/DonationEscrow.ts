import { expect } from "chai";
import hre, { network } from "hardhat";

const { ethers } = await network.create();

// Nilai uji (dummy). Semua dana adalah mata uang native jaringan simulasi lokal.
const ETH = (n: string) => ethers.parseEther(n);
const DAY = 24 * 60 * 60;

// Pemetaan enum Solidity (hindari `enum` TypeScript agar kompatibel dengan type stripping Node).
const CS = { Funding: 0n, Active: 1n, Disputed: 2n, Failed: 3n, Cancelled: 4n, Completed: 5n } as const;
const MS = { Pending: 0n, Submitted: 1n, Approved: 2n, Rejected: 3n, Escalated: 4n, Released: 5n } as const;

const HASH_META = ethers.keccak256(ethers.toUtf8Bytes("dokumen-kampanye-dummy"));
const hashOf = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

async function now(): Promise<number> {
  const b = await ethers.provider.getBlock("latest");
  return b!.timestamp;
}

async function advance(seconds: number): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

// Akun uji bawaan jaringan simulasi (dummy).
async function actors() {
  const [regulator, organizer, verifier, verifier2, executor, donorA, donorB, stranger] =
    await ethers.getSigners();
  return { regulator, organizer, verifier, verifier2, executor, donorA, donorB, stranger };
}

type Actors = Awaited<ReturnType<typeof actors>>;

// Menyiapkan kontrak dengan organizer dan dua verifikator yang sudah disetujui Regulator.
async function deploy() {
  const a = await actors();
  const escrow = await ethers.deployContract("DonationEscrow", [a.regulator.address]);
  await escrow.connect(a.regulator).setOrganizerApproval(a.organizer.address, true);
  await escrow.connect(a.regulator).setVerifierApproval(a.verifier.address, true);
  await escrow.connect(a.regulator).setVerifierApproval(a.verifier2.address, true);
  return { escrow, ...a };
}

type CampaignOpts = {
  target?: bigint;
  deadlineIn?: number;
  opCostBps?: number;
  shares?: number[];
  verifier?: string;
  executor?: string;
};

async function createCampaign(
  escrow: Awaited<ReturnType<typeof deploy>>["escrow"],
  a: Actors,
  o: CampaignOpts = {},
): Promise<bigint> {
  const deadline = (await now()) + (o.deadlineIn ?? 30 * DAY);
  await escrow
    .connect(a.organizer)
    .createCampaign(
      HASH_META,
      o.target ?? ETH("1"),
      deadline,
      o.opCostBps ?? 500,
      o.verifier ?? a.verifier.address,
      o.executor ?? a.executor.address,
      o.shares ?? [3000, 3000, 4000],
    );
  return await escrow.campaignCount();
}

// Kampanye berstatus Active: A 0.6 + B 0.4 = 1.0 (target tercapai).
async function activeCampaign(
  escrow: Awaited<ReturnType<typeof deploy>>["escrow"],
  a: Actors,
  o: CampaignOpts = {},
): Promise<bigint> {
  const id = await createCampaign(escrow, a, o);
  await escrow.connect(a.donorA).donate(id, { value: ETH("0.6") });
  await escrow.connect(a.donorB).donate(id, { value: ETH("0.4") });
  await escrow.finalizeFunding(id);
  return id;
}

// Satu milestone: submit, approve, lewati challenge window, release.
async function completeMilestone(
  escrow: Awaited<ReturnType<typeof deploy>>["escrow"],
  a: Actors,
  id: bigint,
  m: number,
): Promise<void> {
  await escrow.connect(a.executor).submitEvidence(id, m, hashOf(`bukti-${id}-${m}`));
  await escrow.connect(a.verifier).approveMilestone(id, m);
  await advance(2 * DAY + 1);
  await escrow.release(id, m);
}

describe("DonationEscrow", function () {
  // -------------------------------------------------------------------------
  it("TC-01 [REQ-01,03,04,05,16] alur normal: tiga milestone sampai Completed", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);

    expect((await escrow.getCampaign(id)).status).to.equal(CS.Active);

    for (let m = 0; m < 3; m++) {
      await completeMilestone(escrow, a, id, m);
      expect((await escrow.getMilestone(id, m)).status).to.equal(MS.Released);
    }

    const c = await escrow.getCampaign(id);
    expect(c.status).to.equal(CS.Completed);
    expect(c.totalRaised).to.equal(ETH("1"));
    expect(c.releasedGross).to.equal(ETH("1")); // INV-2

    // Biaya operasional 5% dari tiap milestone: total 0.05 untuk organizer, 0.95 untuk pelaksana.
    expect(await escrow.claimable(a.organizer.address)).to.equal(ETH("0.05"));
    expect(await escrow.claimable(a.executor.address)).to.equal(ETH("0.95"));

    await escrow.connect(a.executor).withdraw();
    await escrow.connect(a.organizer).withdraw();
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
  });

  // -------------------------------------------------------------------------
  it("TC-02 [REQ-02] menolak total porsi milestone selain 10000", async function () {
    const { escrow, ...a } = await deploy();
    await expect(createCampaign(escrow, a, { shares: [3000, 3000] })).to.be.revertedWithCustomError(
      escrow,
      "InvalidMilestoneShares",
    );
    await expect(createCampaign(escrow, a, { shares: [6000, 5000] })).to.be.revertedWithCustomError(
      escrow,
      "InvalidMilestoneShares",
    );
    await expect(createCampaign(escrow, a, { shares: [10000, 0] })).to.be.revertedWithCustomError(
      escrow,
      "InvalidMilestoneShares",
    );
  });

  // -------------------------------------------------------------------------
  it("TC-03 [REQ-10] akun yang belum disetujui tidak dapat membuat kampanye", async function () {
    const { escrow, ...a } = await deploy();
    const deadline = (await now()) + 30 * DAY;
    await expect(
      escrow
        .connect(a.stranger)
        .createCampaign(HASH_META, ETH("1"), deadline, 500, a.verifier.address, a.executor.address, [10000]),
    ).to.be.revertedWithCustomError(escrow, "NotOrganizer");
  });

  // -------------------------------------------------------------------------
  it("TC-04 [REQ-14] verifikator tidak boleh sama dengan organizer atau pelaksana", async function () {
    const { escrow, ...a } = await deploy();
    // Organizer juga disetujui sebagai verifikator agar yang diuji murni pemisahan tugas.
    await escrow.connect(a.regulator).setVerifierApproval(a.organizer.address, true);
    await escrow.connect(a.regulator).setVerifierApproval(a.executor.address, true);

    await expect(createCampaign(escrow, a, { verifier: a.organizer.address })).to.be.revertedWithCustomError(
      escrow,
      "RoleConflict",
    );
    await expect(createCampaign(escrow, a, { verifier: a.executor.address })).to.be.revertedWithCustomError(
      escrow,
      "RoleConflict",
    );
  });

  // -------------------------------------------------------------------------
  it("TC-05 [REQ-01,10] organizer tidak dapat menarik dana escrow langsung", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);
    const addr = await escrow.getAddress();
    const before = await ethers.provider.getBalance(addr);

    await expect(escrow.connect(a.organizer).withdraw()).to.be.revertedWithCustomError(escrow, "NothingToWithdraw");
    await expect(escrow.connect(a.organizer).refund(id)).to.be.revertedWithCustomError(escrow, "WrongState");
    await expect(escrow.connect(a.organizer).release(id, 0)).to.be.revertedWithCustomError(escrow, "WrongState");

    expect(await ethers.provider.getBalance(addr)).to.equal(before);
    expect(before).to.equal(ETH("1"));
  });

  // -------------------------------------------------------------------------
  it("TC-06 [REQ-03,10] pemanggil tidak berwenang ditolak pada fungsi sensitif", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);
    await escrow.connect(a.executor).submitEvidence(id, 0, hashOf("bukti"));

    await expect(escrow.connect(a.stranger).approveMilestone(id, 0)).to.be.revertedWithCustomError(
      escrow,
      "NotVerifier",
    );
    await expect(escrow.connect(a.stranger).rejectMilestone(id, 0, 1)).to.be.revertedWithCustomError(
      escrow,
      "NotVerifier",
    );
    await expect(escrow.connect(a.stranger).setParams(1000, DAY, DAY, 500)).to.be.revertedWithCustomError(
      escrow,
      "NotRegulator",
    );
    await expect(escrow.connect(a.stranger).pause()).to.be.revertedWithCustomError(escrow, "NotRegulator");
    await expect(escrow.connect(a.stranger).submitEvidence(id, 0, hashOf("x"))).to.be.revertedWithCustomError(
      escrow,
      "NotExecutor",
    );
    await expect(escrow.connect(a.organizer).setVerifierApproval(a.stranger.address, true)).to.be.revertedWithCustomError(
      escrow,
      "NotRegulator",
    );
  });

  // -------------------------------------------------------------------------
  it("TC-07 [REQ-07] biaya operasional di atas batas ditolak", async function () {
    const { escrow, ...a } = await deploy();
    expect(await escrow.maxOpCostBps()).to.equal(1000n);
    await expect(createCampaign(escrow, a, { opCostBps: 1500 })).to.be.revertedWithCustomError(escrow, "OpCostTooHigh");
    await createCampaign(escrow, a, { opCostBps: 1000 }); // tepat di batas diterima
  });

  // -------------------------------------------------------------------------
  it("TC-08 [REQ-06] kampanye gagal target: refund penuh dan tidak dapat ganda", async function () {
    const { escrow, ...a } = await deploy();
    const id = await createCampaign(escrow, a, { deadlineIn: 7 * DAY });
    await escrow.connect(a.donorA).donate(id, { value: ETH("0.3") });

    await expect(escrow.finalizeFunding(id)).to.be.revertedWithCustomError(escrow, "FundingStillOpen");

    await advance(7 * DAY + 1);
    await expect(escrow.connect(a.donorB).donate(id, { value: ETH("0.1") })).to.be.revertedWithCustomError(
      escrow,
      "FundingClosed",
    );
    await escrow.finalizeFunding(id);
    expect((await escrow.getCampaign(id)).status).to.equal(CS.Failed);

    await expect(escrow.connect(a.donorA).refund(id)).to.emit(escrow, "Refunded").withArgs(id, a.donorA.address, ETH("0.3"));
    await expect(escrow.connect(a.donorA).refund(id)).to.be.revertedWithCustomError(escrow, "AlreadyRefunded");
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
  });

  // -------------------------------------------------------------------------
  it("TC-09 [REQ-08] sengketa: ambang donatur, pembekuan release, lalu dilanjutkan Regulator", async function () {
    const { escrow, ...a } = await deploy();
    // A 0.96 (96%), B 0.04 (4%, di bawah ambang 5%).
    const id = await createCampaign(escrow, a);
    await escrow.connect(a.donorA).donate(id, { value: ETH("0.96") });
    await escrow.connect(a.donorB).donate(id, { value: ETH("0.04") });
    await escrow.finalizeFunding(id);

    await escrow.connect(a.executor).submitEvidence(id, 0, hashOf("bukti-0"));
    await escrow.connect(a.verifier).approveMilestone(id, 0);

    // Donatur di bawah ambang ditolak; orang asing juga.
    await expect(escrow.connect(a.donorB).openDispute(id)).to.be.revertedWithCustomError(escrow, "DisputeThresholdNotMet");
    await expect(escrow.connect(a.stranger).openDispute(id)).to.be.revertedWithCustomError(escrow, "DisputeThresholdNotMet");

    // Donatur di atas ambang berhasil membuka sengketa pada masa challenge window.
    await expect(escrow.connect(a.donorA).openDispute(id)).to.emit(escrow, "DisputeOpened").withArgs(id, a.donorA.address);
    expect((await escrow.getCampaign(id)).status).to.equal(CS.Disputed);

    // Selama sengketa, release dan approve tidak mungkin walau challenge window sudah lewat.
    await advance(2 * DAY + 1);
    await expect(escrow.release(id, 0)).to.be.revertedWithCustomError(escrow, "WrongState");
    await expect(escrow.connect(a.verifier).approveMilestone(id, 0)).to.be.revertedWithCustomError(escrow, "WrongState");

    // Hanya Regulator yang memutuskan.
    await expect(escrow.connect(a.donorA).resolveDispute(id, true, hashOf("k"))).to.be.revertedWithCustomError(
      escrow,
      "NotRegulator",
    );
    await escrow.connect(a.regulator).resolveDispute(id, true, hashOf("keputusan-lanjut"));
    expect((await escrow.getCampaign(id)).status).to.equal(CS.Active);

    await escrow.release(id, 0);
    expect((await escrow.getMilestone(id, 0)).status).to.equal(MS.Released);
  });

  // -------------------------------------------------------------------------
  it("TC-10 [REQ-16] release baru berhasil setelah challenge window", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);
    await escrow.connect(a.executor).submitEvidence(id, 0, hashOf("bukti-0"));
    await escrow.connect(a.verifier).approveMilestone(id, 0);

    await expect(escrow.release(id, 0)).to.be.revertedWithCustomError(escrow, "ChallengeWindowOpen");
    await advance(2 * DAY - 60);
    await expect(escrow.release(id, 0)).to.be.revertedWithCustomError(escrow, "ChallengeWindowOpen");
    await advance(120);
    await escrow.release(id, 0);
    expect((await escrow.getMilestone(id, 0)).status).to.equal(MS.Released);
  });

  // -------------------------------------------------------------------------
  it("TC-11 [REQ-12] saat pause: donate dan withdraw diblokir, refund tetap berjalan", async function () {
    const { escrow, ...a } = await deploy();
    // Kampanye 1: gagal target. Kampanye 2: Active dengan milestone yang sudah dilepas.
    const failed = await createCampaign(escrow, a, { deadlineIn: 3 * DAY });
    await escrow.connect(a.donorA).donate(failed, { value: ETH("0.2") });
    await advance(3 * DAY + 1);
    await escrow.finalizeFunding(failed);

    const active = await activeCampaign(escrow, a);
    await completeMilestone(escrow, a, active, 0);
    expect(await escrow.claimable(a.executor.address)).to.be.greaterThan(0n);

    await escrow.connect(a.regulator).pause();

    await expect(escrow.connect(a.donorB).donate(failed, { value: 1n })).to.be.revertedWithCustomError(
      escrow,
      "ContractPaused",
    );
    await expect(escrow.connect(a.executor).withdraw()).to.be.revertedWithCustomError(escrow, "ContractPaused");
    await expect(escrow.connect(a.executor).submitEvidence(active, 1, hashOf("b1"))).to.be.revertedWithCustomError(
      escrow,
      "ContractPaused",
    );

    // Refund tetap berfungsi.
    await expect(escrow.connect(a.donorA).refund(failed)).to.emit(escrow, "Refunded").withArgs(failed, a.donorA.address, ETH("0.2"));

    // Setelah unpause, withdraw kembali berfungsi.
    await escrow.connect(a.regulator).unpause();
    await escrow.connect(a.executor).withdraw();
  });

  // -------------------------------------------------------------------------
  it("TC-12 [REQ-11] pencabutan verifikator berlaku seketika dan penggantian menjaga dana dan riwayat", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);
    await escrow.connect(a.executor).submitEvidence(id, 0, hashOf("bukti-0"));
    const balanceBefore = await ethers.provider.getBalance(await escrow.getAddress());

    // Pencabutan persetujuan menutup hak V1 walau belum diganti.
    await escrow.connect(a.regulator).setVerifierApproval(a.verifier.address, false);
    await expect(escrow.connect(a.verifier).approveMilestone(id, 0)).to.be.revertedWithCustomError(escrow, "NotVerifier");

    // Pengganti harus berbeda dari organizer dan pelaksana, dan disetujui.
    await expect(escrow.connect(a.regulator).replaceVerifier(id, a.executor.address)).to.be.revertedWithCustomError(
      escrow,
      "RoleConflict",
    );
    await expect(escrow.connect(a.stranger).replaceVerifier(id, a.verifier2.address)).to.be.revertedWithCustomError(
      escrow,
      "NotRegulator",
    );

    await expect(escrow.connect(a.regulator).replaceVerifier(id, a.verifier2.address))
      .to.emit(escrow, "VerifierReplaced")
      .withArgs(id, a.verifier.address, a.verifier2.address);

    // V1 tetap tidak bisa; V2 bisa.
    await expect(escrow.connect(a.verifier).approveMilestone(id, 0)).to.be.revertedWithCustomError(escrow, "NotVerifier");
    await escrow.connect(a.verifier2).approveMilestone(id, 0);

    // Dana dan riwayat tidak berubah.
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(balanceBefore);
    const c = await escrow.getCampaign(id);
    expect(c.totalRaised).to.equal(ETH("1"));
    expect((await escrow.getMilestone(id, 0)).evidenceHash).to.equal(hashOf("bukti-0"));
  });

  // -------------------------------------------------------------------------
  it("TC-13 [REQ-15] verifikator tidak merespons: eskalasi, bukan pelepasan otomatis", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);
    await escrow.connect(a.executor).submitEvidence(id, 0, hashOf("bukti-0"));

    await expect(escrow.escalate(id, 0)).to.be.revertedWithCustomError(escrow, "VerificationWindowNotElapsed");

    await advance(7 * DAY + 1);
    await escrow.escalate(id, 0);
    expect((await escrow.getMilestone(id, 0)).status).to.equal(MS.Escalated);

    // Tidak ada jalur pelepasan: milestone tidak Approved, dan verifikator lama tidak dapat menyetujui.
    await expect(escrow.release(id, 0)).to.be.revertedWithCustomError(escrow, "WrongState");
    await expect(escrow.connect(a.verifier).approveMilestone(id, 0)).to.be.revertedWithCustomError(escrow, "WrongState");
    expect(await escrow.claimable(a.executor.address)).to.equal(0n);

    // Regulator mengganti verifikator: milestone kembali Submitted dengan jendela baru.
    await escrow.connect(a.regulator).replaceVerifier(id, a.verifier2.address);
    expect((await escrow.getMilestone(id, 0)).status).to.equal(MS.Submitted);
    await expect(escrow.escalate(id, 0)).to.be.revertedWithCustomError(escrow, "VerificationWindowNotElapsed");
    await escrow.connect(a.verifier2).approveMilestone(id, 0);
  });

  // -------------------------------------------------------------------------
  it("TC-14 [REQ-01,06] pembatalan setelah pelepasan sebagian: refund pro-rata dan saldo mencukupi", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);
    await completeMilestone(escrow, a, id, 0); // 0.3 dilepas (0.285 pelaksana, 0.015 organizer)

    await expect(escrow.connect(a.stranger).cancelCampaign(id)).to.be.revertedWithCustomError(escrow, "NotOrganizer");
    await expect(escrow.connect(a.organizer).cancelCampaign(id)).to.be.revertedWithCustomError(escrow, "WrongState");
    await escrow.connect(a.regulator).cancelCampaign(id);
    expect((await escrow.getCampaign(id)).status).to.equal(CS.Cancelled);

    // Sisa escrow 0.7: A (0.6) menerima 0.42, B (0.4) menerima 0.28.
    await expect(escrow.connect(a.donorA).refund(id)).to.emit(escrow, "Refunded").withArgs(id, a.donorA.address, ETH("0.42"));
    await expect(escrow.connect(a.donorB).refund(id)).to.emit(escrow, "Refunded").withArgs(id, a.donorB.address, ETH("0.28"));

    // INV-3: saldo kontrak setelah semua refund tidak kurang dari kewajiban claimable.
    const balance = await ethers.provider.getBalance(await escrow.getAddress());
    const obligations = (await escrow.claimable(a.executor.address)) + (await escrow.claimable(a.organizer.address));
    expect(balance).to.equal(ETH("0.3"));
    expect(balance >= obligations).to.equal(true);

    // Dana yang sudah dilepas tetap dapat ditarik.
    await escrow.connect(a.executor).withdraw();
    await escrow.connect(a.organizer).withdraw();
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
  });

  // -------------------------------------------------------------------------
  it("TC-15 [REQ-13] urutan event audit pada siklus lengkap satu milestone", async function () {
    const { escrow, ...a } = await deploy();
    const addr = await escrow.getAddress();
    const startBlock = (await ethers.provider.getBlockNumber()) + 1;

    const id = await createCampaign(escrow, a, { shares: [10000], target: ETH("1") });
    await escrow.connect(a.donorA).donate(id, { value: ETH("1") });
    await escrow.finalizeFunding(id);
    await escrow.connect(a.executor).submitEvidence(id, 0, hashOf("bukti"));
    await escrow.connect(a.verifier).approveMilestone(id, 0);
    await advance(2 * DAY + 1);
    await escrow.release(id, 0);
    await escrow.connect(a.executor).withdraw();

    const logs = await ethers.provider.getLogs({ address: addr, fromBlock: startBlock, toBlock: "latest" });
    const names = logs.map((l) => escrow.interface.parseLog(l)!.name);
    expect(names).to.deep.equal([
      "CampaignCreated",
      "CampaignTerms",
      "Donated",
      "FundingFinalized",
      "EvidenceSubmitted",
      "MilestoneApproved",
      "MilestoneReleased",
      "CampaignCompleted",
      "Withdrawn",
    ]);

    // Argumen event kunci benar.
    const released = escrow.interface.parseLog(logs[6])!;
    expect(released.args.netAmount).to.equal(ETH("0.95"));
    expect(released.args.opCost).to.equal(ETH("0.05"));
  });

  // -------------------------------------------------------------------------
  it("TC-16a [REQ-01] re-entrancy pada refund hanya membayar satu kali", async function () {
    const { escrow, ...a } = await deploy();
    const attacker = await ethers.deployContract("ReentrancyAttacker");
    const escrowAddr = await escrow.getAddress();
    const attackerAddr = await attacker.getAddress();

    // Target tinggi agar kampanye berakhir Failed. Donatur lain (0.6) menyediakan dana yang
    // cukup agar pembayaran ganda kepada penyerang (2 x 0.5) SECARA TEKNIS mungkin terjadi
    // bila kontrak rentan. Tanpa dana cadangan ini serangan gagal karena saldo habis, bukan
    // karena perlindungan, dan test tidak membuktikan apa pun (ditemukan lewat uji mutasi).
    const id = await createCampaign(escrow, a, { deadlineIn: 3 * DAY, target: ETH("5") });
    await attacker.fund({ value: ETH("0.5") });
    await attacker.exec(escrowAddr, ETH("0.5"), escrow.interface.encodeFunctionData("donate", [id]));
    await escrow.connect(a.donorB).donate(id, { value: ETH("0.6") });
    await advance(3 * DAY + 1);
    await escrow.finalizeFunding(id); // Failed
    expect(await ethers.provider.getBalance(escrowAddr)).to.equal(ETH("1.1"));

    // Saat menerima refund, penyerang mencoba memanggil refund lagi.
    await attacker.arm(escrowAddr, escrow.interface.encodeFunctionData("refund", [id]));
    await attacker.exec(escrowAddr, 0n, escrow.interface.encodeFunctionData("refund", [id]));

    expect(await attacker.reentryAttempted()).to.equal(true);
    expect(await attacker.reentrySucceeded()).to.equal(false);
    expect(await attacker.received()).to.equal(ETH("0.5"));
    expect(await escrow.refunded(id, attackerAddr)).to.equal(true);
    // Dana donatur lain utuh.
    expect(await ethers.provider.getBalance(escrowAddr)).to.equal(ETH("0.6"));
    await escrow.connect(a.donorB).refund(id);
    expect(await ethers.provider.getBalance(escrowAddr)).to.equal(0n);
  });

  it("TC-16b [REQ-01] re-entrancy pada withdraw hanya membayar satu kali", async function () {
    const { escrow, ...a } = await deploy();
    const attacker = await ethers.deployContract("ReentrancyAttacker");
    const escrowAddr = await escrow.getAddress();
    const attackerAddr = await attacker.getAddress();

    // Penyerang menjadi pelaksana kampanye.
    const id = await createCampaign(escrow, a, { shares: [10000], executor: attackerAddr });
    await escrow.connect(a.donorA).donate(id, { value: ETH("1") });
    await escrow.finalizeFunding(id);

    // Kampanye lain menyediakan dana cadangan (1) di kontrak yang sama. Tanpa ini, penarikan
    // ganda (2 x 0.95) tidak mungkin karena saldo habis, dan test tidak membuktikan perlindungan
    // (ditemukan lewat uji mutasi).
    const decoy = await createCampaign(escrow, a, { target: ETH("5") });
    await escrow.connect(a.donorB).donate(decoy, { value: ETH("1") });
    expect(await ethers.provider.getBalance(escrowAddr)).to.equal(ETH("2"));
    await attacker.exec(escrowAddr, 0n, escrow.interface.encodeFunctionData("submitEvidence", [id, 0, hashOf("bukti")]));
    await escrow.connect(a.verifier).approveMilestone(id, 0);
    await advance(2 * DAY + 1);
    await escrow.release(id, 0);
    expect(await escrow.claimable(attackerAddr)).to.equal(ETH("0.95"));

    await attacker.arm(escrowAddr, escrow.interface.encodeFunctionData("withdraw"));
    await attacker.exec(escrowAddr, 0n, escrow.interface.encodeFunctionData("withdraw"));

    expect(await attacker.reentryAttempted()).to.equal(true);
    expect(await attacker.reentrySucceeded()).to.equal(false);
    expect(await attacker.received()).to.equal(ETH("0.95"));
    expect(await escrow.claimable(attackerAddr)).to.equal(0n);
    // Sisa saldo kontrak: dana kampanye cadangan (1) dan hak organizer (0.05) yang belum ditarik.
    expect(await ethers.provider.getBalance(escrowAddr)).to.equal(ETH("1.05"));
    expect(await escrow.claimable(a.organizer.address)).to.equal(ETH("0.05"));
  });

  // -------------------------------------------------------------------------
  it("TC-18 [REQ-02,06] pembulatan: total dilepas tepat sama dengan total terkumpul", async function () {
    const { escrow, ...a } = await deploy();
    // Angka ganjil agar pembagian basis poin menghasilkan sisa pembulatan.
    const total = 1_000_000_000_000_000_007n;
    const id = await createCampaign(escrow, a, { target: total, shares: [3333, 3333, 3334], opCostBps: 777 });
    await escrow.connect(a.donorA).donate(id, { value: total });
    await escrow.finalizeFunding(id);

    for (let m = 0; m < 3; m++) {
      await completeMilestone(escrow, a, id, m);
    }

    const c = await escrow.getCampaign(id);
    expect(c.status).to.equal(CS.Completed);
    expect(c.releasedGross).to.equal(total); // INV-1 dan INV-2

    const credited = (await escrow.claimable(a.executor.address)) + (await escrow.claimable(a.organizer.address));
    expect(credited).to.equal(total); // tidak ada dana tertahan atau tercetak berlebih

    await escrow.connect(a.executor).withdraw();
    await escrow.connect(a.organizer).withdraw();
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);
  });

  // -------------------------------------------------------------------------
  it("TC-19 [REQ-03,04] urutan milestone, hash nol, dan siklus tolak lalu ajukan ulang", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);

    // Milestone 1 tidak boleh diajukan sebelum milestone 0 Released.
    await expect(escrow.connect(a.executor).submitEvidence(id, 1, hashOf("b1"))).to.be.revertedWithCustomError(
      escrow,
      "PreviousMilestoneNotReleased",
    );
    await expect(escrow.connect(a.executor).submitEvidence(id, 0, ethers.ZeroHash)).to.be.revertedWithCustomError(
      escrow,
      "ZeroHash",
    );
    await expect(escrow.connect(a.executor).submitEvidence(id, 3, hashOf("b"))).to.be.revertedWithCustomError(
      escrow,
      "InvalidMilestone",
    );

    // Ajukan, ditolak verifikator, lalu diajukan ulang dengan bukti baru.
    await escrow.connect(a.executor).submitEvidence(id, 0, hashOf("bukti-lama"));
    await expect(escrow.connect(a.verifier).rejectMilestone(id, 0, 7))
      .to.emit(escrow, "MilestoneRejected")
      .withArgs(id, 0, 7);
    expect((await escrow.getMilestone(id, 0)).status).to.equal(MS.Rejected);

    await expect(escrow.connect(a.verifier).approveMilestone(id, 0)).to.be.revertedWithCustomError(escrow, "WrongState");
    await advance(2 * DAY + 1);
    await expect(escrow.release(id, 0)).to.be.revertedWithCustomError(escrow, "WrongState");

    await escrow.connect(a.executor).submitEvidence(id, 0, hashOf("bukti-baru"));
    const ms = await escrow.getMilestone(id, 0);
    expect(ms.status).to.equal(MS.Submitted);
    expect(ms.evidenceHash).to.equal(hashOf("bukti-baru"));

    await escrow.connect(a.verifier).approveMilestone(id, 0);
    await advance(2 * DAY + 1);
    await escrow.release(id, 0);
    expect((await escrow.getMilestone(id, 0)).status).to.equal(MS.Released);
  });

  // -------------------------------------------------------------------------
  it("TC-17 [REQ-09] inspeksi ABI: tidak ada tipe string atau bytes dinamis (tanpa data pribadi)", async function () {
    const artifact = await hre.artifacts.readArtifact("DonationEscrow");

    const types: string[] = [];
    const walk = (params: any[] | undefined) => {
      for (const p of params ?? []) {
        types.push(p.type);
        if (p.components) walk(p.components);
      }
    };
    for (const item of artifact.abi as any[]) {
      walk(item.inputs);
      walk(item.outputs);
    }

    const forbidden = types.filter((t) => t.startsWith("string") || t === "bytes" || t.startsWith("bytes[]"));
    expect(forbidden, "tipe terlarang di ABI").to.deep.equal([]);

    // Tipe yang dipakai hanya: alamat, bilangan, bool, bytes32, enum (uint8), larik bilangan,
    // dan tuple (struct, yang komponennya diperiksa satu per satu oleh walk di atas).
    const allowed = /^(address|bool|bytes32|tuple|uint(8|16|64|256)|uint16\[\])$/;
    const unexpected = [...new Set(types)].filter((t) => !allowed.test(t));
    expect(unexpected, "tipe di luar daftar yang diizinkan").to.deep.equal([]);
  });

  // -------------------------------------------------------------------------
  it("TC-20 [REQ-08, A-01] donatur hanya dapat membuka satu sengketa per kampanye", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);

    await escrow.connect(a.donorA).openDispute(id);
    await escrow.connect(a.regulator).resolveDispute(id, true, hashOf("keputusan-1"));

    // Donatur yang sama tidak dapat membekukan kampanye lagi.
    await expect(escrow.connect(a.donorA).openDispute(id)).to.be.revertedWithCustomError(escrow, "DisputeAlreadyUsed");
    expect((await escrow.getCampaign(id)).status).to.equal(CS.Active);

    // Donatur lain di atas ambang masih punya satu kesempatan, dan Regulator tidak dibatasi.
    await escrow.connect(a.donorB).openDispute(id);
    await escrow.connect(a.regulator).resolveDispute(id, true, hashOf("keputusan-2"));
    await escrow.connect(a.regulator).openDispute(id);
    expect((await escrow.getCampaign(id)).status).to.equal(CS.Disputed);
  });

  // -------------------------------------------------------------------------
  it("TC-21 [REQ-02, A-02] tenggat pendanaan dibatasi paling lama 365 hari", async function () {
    const { escrow, ...a } = await deploy();

    // Tepat di batas diterima, melebihi batas ditolak.
    await createCampaign(escrow, a, { deadlineIn: 365 * DAY - 5 });
    await expect(createCampaign(escrow, a, { deadlineIn: 365 * DAY + 5 * DAY })).to.be.revertedWithCustomError(
      escrow,
      "InvalidParams",
    );
    await expect(createCampaign(escrow, a, { deadlineIn: 1000 * 365 * DAY })).to.be.revertedWithCustomError(
      escrow,
      "InvalidParams",
    );
  });

  // -------------------------------------------------------------------------
  it("TC-22 [REQ-08, A-04] keputusan sengketa wajib memuat hash dokumen", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);
    await escrow.connect(a.regulator).openDispute(id);

    await expect(escrow.connect(a.regulator).resolveDispute(id, true, ethers.ZeroHash)).to.be.revertedWithCustomError(
      escrow,
      "ZeroHash",
    );
    expect((await escrow.getCampaign(id)).status).to.equal(CS.Disputed);

    await escrow.connect(a.regulator).resolveDispute(id, true, hashOf("keputusan"));
    expect((await escrow.getCampaign(id)).status).to.equal(CS.Active);
  });

  // -------------------------------------------------------------------------
  it("TC-23 [REQ-15, A-05] jendela verifikasi diatur ulang saat sengketa dilanjutkan", async function () {
    const { escrow, ...a } = await deploy();
    const id = await activeCampaign(escrow, a);
    await escrow.connect(a.executor).submitEvidence(id, 0, hashOf("bukti-0"));

    await escrow.connect(a.regulator).openDispute(id);
    await advance(8 * DAY); // lebih lama dari verificationWindow 7 hari
    await escrow.connect(a.regulator).resolveDispute(id, true, hashOf("keputusan"));

    // Verifikator belum sempat menilai, jadi eskalasi langsung ditolak.
    await expect(escrow.escalate(id, 0)).to.be.revertedWithCustomError(escrow, "VerificationWindowNotElapsed");

    // Setelah jendela baru berakhir, eskalasi berjalan seperti biasa.
    await advance(7 * DAY + 1);
    await escrow.escalate(id, 0);
    expect((await escrow.getMilestone(id, 0)).status).to.equal(MS.Escalated);
  });
});
