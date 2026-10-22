// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title DonationEscrow
/// @notice Escrow donasi berbasis milestone dengan verifikator independen.
/// @dev Prototype untuk Tugas Perseorangan Blockchain. Hanya untuk jaringan uji lokal.
///      Dana yang ditahan adalah mata uang native jaringan uji (dummy), bukan dana nyata.
///      Tidak ada data pribadi di dalam kontrak: hanya alamat, angka, hash, dan enum.
///      Kebenaran isi dokumen bukti TIDAK diperiksa oleh kontrak; kontrak hanya mencatat
///      hash dan keputusan verifikator (lihat asumsi TA-01 dan TA-02 di laporan).
contract DonationEscrow is ReentrancyGuard {
    // ---------------------------------------------------------------------
    // Tipe
    // ---------------------------------------------------------------------

    enum CampaignStatus {
        Funding,
        Active,
        Disputed,
        Failed,
        Cancelled,
        Completed
    }

    enum MilestoneStatus {
        Pending,
        Submitted,
        Approved,
        Rejected,
        Escalated,
        Released
    }

    struct Campaign {
        address organizer;
        CampaignStatus status;
        uint16 opCostBps;
        uint8 milestoneCount;
        uint64 fundingDeadline;
        address verifier;
        address executor;
        bytes32 metadataHash;
        uint256 fundingTarget;
        uint256 totalRaised;
        uint256 releasedGross;
    }

    struct Milestone {
        MilestoneStatus status;
        uint16 shareBps;
        uint64 submittedAt;
        uint64 approvedAt;
        bytes32 evidenceHash;
    }

    // ---------------------------------------------------------------------
    // Konstanta dan state
    // ---------------------------------------------------------------------

    uint256 public constant BPS = 10_000;
    uint8 public constant MAX_MILESTONES = 10;
    uint64 public constant MAX_WINDOW = 365 days;

    /// @notice Alamat Regulator. Pada produksi diasumsikan multisig.
    address public immutable regulator;
    bool public paused;

    /// @dev Nilai bawaan adalah ASUMSI uji, bukan ketentuan hukum terverifikasi.
    uint16 public maxOpCostBps = 1000;
    uint64 public verificationWindow = 7 days;
    uint64 public challengeWindow = 2 days;
    uint16 public disputeThresholdBps = 500;

    uint256 public campaignCount;

    mapping(uint256 => Campaign) private _campaigns;
    mapping(uint256 => mapping(uint8 => Milestone)) private _milestones;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    /// @dev Jendela disalin dari parameter global saat kampanye dibuat. Mitigasi A-03.
    struct Windows {
        uint64 verification;
        uint64 challenge;
    }
    mapping(uint256 => Windows) public campaignWindows;
    mapping(uint256 => mapping(address => bool)) public refunded;
    /// @notice Donatur hanya boleh membuka satu sengketa per kampanye (mitigasi A-01 dan R-06).
    mapping(uint256 => mapping(address => bool)) public disputeUsed;
    mapping(address => uint256) public claimable;
    mapping(address => bool) public approvedOrganizers;
    mapping(address => bool) public approvedVerifiers;

    // ---------------------------------------------------------------------
    // Event (REQ-13)
    // ---------------------------------------------------------------------

    event OrganizerApprovalSet(address indexed account, bool approved);
    event VerifierApprovalSet(address indexed account, bool approved);
    event ParamsChanged(uint16 maxOpCostBps, uint64 verificationWindow, uint64 challengeWindow, uint16 disputeThresholdBps);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    event CampaignCreated(
        uint256 indexed id,
        address indexed organizer,
        address verifier,
        address executor,
        bytes32 metadataHash
    );
    event CampaignTerms(uint256 indexed id, uint256 fundingTarget, uint64 fundingDeadline, uint16 opCostBps, uint16[] shares);
    event Donated(uint256 indexed id, address indexed donor, uint256 amount);
    event FundingFinalized(uint256 indexed id, CampaignStatus status);
    event EvidenceSubmitted(uint256 indexed id, uint8 milestone, bytes32 evidenceHash);
    event MilestoneApproved(uint256 indexed id, uint8 milestone);
    event MilestoneRejected(uint256 indexed id, uint8 milestone, uint8 reasonCode);
    event MilestoneEscalated(uint256 indexed id, uint8 milestone);
    event MilestoneReleased(uint256 indexed id, uint8 milestone, uint256 netAmount, uint256 opCost);
    event CampaignCompleted(uint256 indexed id);
    event DisputeOpened(uint256 indexed id, address indexed by);
    event DisputeResolved(uint256 indexed id, bool resumed, bytes32 decisionHash);
    event CampaignCancelled(uint256 indexed id, address indexed by);
    event VerifierReplaced(uint256 indexed id, address indexed oldVerifier, address indexed newVerifier);
    event Refunded(uint256 indexed id, address indexed donor, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    // ---------------------------------------------------------------------
    // Error (tanpa string; REQ-10)
    // ---------------------------------------------------------------------

    error NotRegulator();
    error NotOrganizer();
    error NotVerifier();
    error NotExecutor();
    error CampaignNotFound();
    error InvalidParams();
    error InvalidMilestoneCount();
    error InvalidMilestoneShares();
    error InvalidMilestone();
    error OpCostTooHigh();
    error RoleConflict();
    error VerifierNotApproved();
    error WrongState();
    error FundingClosed();
    error FundingStillOpen();
    error ZeroAmount();
    error ZeroHash();
    error PreviousMilestoneNotReleased();
    error ChallengeWindowOpen();
    error VerificationWindowNotElapsed();
    error DisputeThresholdNotMet();
    error DisputeAlreadyUsed();
    error AlreadyRefunded();
    error NothingToRefund();
    error NothingToWithdraw();
    error ContractPaused();
    error TransferFailed();

    // ---------------------------------------------------------------------
    // Modifier
    // ---------------------------------------------------------------------

    modifier onlyRegulator() {
        if (msg.sender != regulator) revert NotRegulator();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    constructor(address regulator_) {
        if (regulator_ == address(0)) revert InvalidParams();
        regulator = regulator_;
    }

    // ---------------------------------------------------------------------
    // Administrasi Regulator
    // ---------------------------------------------------------------------

    function setOrganizerApproval(address account, bool approved) external onlyRegulator {
        approvedOrganizers[account] = approved;
        emit OrganizerApprovalSet(account, approved);
    }

    function setVerifierApproval(address account, bool approved) external onlyRegulator {
        approvedVerifiers[account] = approved;
        emit VerifierApprovalSet(account, approved);
    }

    function setParams(
        uint16 maxOpCostBps_,
        uint64 verificationWindow_,
        uint64 challengeWindow_,
        uint16 disputeThresholdBps_
    ) external onlyRegulator {
        if (
            maxOpCostBps_ > BPS ||
            verificationWindow_ == 0 || verificationWindow_ > MAX_WINDOW ||
            challengeWindow_ == 0 || challengeWindow_ > MAX_WINDOW ||
            disputeThresholdBps_ == 0 || disputeThresholdBps_ > BPS
        ) revert InvalidParams();
        maxOpCostBps = maxOpCostBps_;
        verificationWindow = verificationWindow_;
        challengeWindow = challengeWindow_;
        disputeThresholdBps = disputeThresholdBps_;
        emit ParamsChanged(maxOpCostBps_, verificationWindow_, challengeWindow_, disputeThresholdBps_);
    }

    function pause() external onlyRegulator {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyRegulator {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ---------------------------------------------------------------------
    // Pembuatan dan pendanaan kampanye
    // ---------------------------------------------------------------------

    /// @param shares Porsi tiap milestone dalam basis poin; jumlahnya harus tepat 10000 (REQ-02).
    function createCampaign(
        bytes32 metadataHash,
        uint256 fundingTarget,
        uint64 fundingDeadline,
        uint16 opCostBps,
        address verifier,
        address executor,
        uint16[] calldata shares
    ) external whenNotPaused returns (uint256 id) {
        if (!approvedOrganizers[msg.sender]) revert NotOrganizer();
        if (
            fundingTarget == 0 ||
            fundingDeadline <= block.timestamp ||
            fundingDeadline > block.timestamp + MAX_WINDOW || // mitigasi A-02: tenggat tidak boleh terlalu jauh
            verifier == address(0) ||
            executor == address(0)
        ) revert InvalidParams();
        _validateShares(shares);
        if (opCostBps > maxOpCostBps) revert OpCostTooHigh();
        // Pemisahan tugas (REQ-14)
        if (verifier == msg.sender || verifier == executor) revert RoleConflict();
        if (!approvedVerifiers[verifier]) revert VerifierNotApproved();

        id = ++campaignCount;
        Campaign storage c = _campaigns[id];
        c.organizer = msg.sender;
        c.status = CampaignStatus.Funding;
        c.opCostBps = opCostBps;
        c.milestoneCount = uint8(shares.length);
        c.fundingDeadline = fundingDeadline;
        c.verifier = verifier;
        c.executor = executor;
        c.metadataHash = metadataHash;
        c.fundingTarget = fundingTarget;
        campaignWindows[id] = Windows(verificationWindow, challengeWindow); // mitigasi A-03
        for (uint256 i = 0; i < shares.length; ++i) {
            _milestones[id][uint8(i)].shareBps = shares[i];
        }

        emit CampaignCreated(id, msg.sender, verifier, executor, metadataHash);
        emit CampaignTerms(id, fundingTarget, fundingDeadline, opCostBps, shares);
    }

    function donate(uint256 id) external payable whenNotPaused {
        Campaign storage c = _campaign(id);
        if (c.status != CampaignStatus.Funding) revert WrongState();
        if (block.timestamp >= c.fundingDeadline) revert FundingClosed();
        if (msg.value == 0) revert ZeroAmount();
        contributions[id][msg.sender] += msg.value;
        c.totalRaised += msg.value;
        emit Donated(id, msg.sender, msg.value);
    }

    /// @notice Siapa pun boleh memanggil. Tidak menggerakkan dana, hanya memindahkan state.
    ///         Sengaja tidak dibatasi pause agar refund selalu dapat dicapai (REQ-12).
    function finalizeFunding(uint256 id) external {
        Campaign storage c = _campaign(id);
        if (c.status != CampaignStatus.Funding) revert WrongState();
        if (c.totalRaised >= c.fundingTarget) {
            c.status = CampaignStatus.Active;
        } else if (block.timestamp >= c.fundingDeadline) {
            c.status = CampaignStatus.Failed;
        } else {
            revert FundingStillOpen();
        }
        emit FundingFinalized(id, c.status);
    }

    // ---------------------------------------------------------------------
    // Milestone
    // ---------------------------------------------------------------------

    function submitEvidence(uint256 id, uint8 m, bytes32 evidenceHash) external whenNotPaused {
        Campaign storage c = _campaign(id);
        if (msg.sender != c.executor) revert NotExecutor();
        if (c.status != CampaignStatus.Active) revert WrongState();
        if (evidenceHash == bytes32(0)) revert ZeroHash();
        Milestone storage ms = _milestone(id, c, m);
        if (ms.status != MilestoneStatus.Pending && ms.status != MilestoneStatus.Rejected) revert WrongState();
        if (m > 0 && _milestones[id][m - 1].status != MilestoneStatus.Released) {
            revert PreviousMilestoneNotReleased();
        }
        ms.status = MilestoneStatus.Submitted;
        ms.evidenceHash = evidenceHash;
        ms.submittedAt = uint64(block.timestamp);
        emit EvidenceSubmitted(id, m, evidenceHash);
    }

    function approveMilestone(uint256 id, uint8 m) external whenNotPaused {
        Campaign storage c = _campaign(id);
        _onlyActiveVerifier(c);
        if (c.status != CampaignStatus.Active) revert WrongState();
        Milestone storage ms = _milestone(id, c, m);
        if (ms.status != MilestoneStatus.Submitted) revert WrongState();
        ms.status = MilestoneStatus.Approved;
        ms.approvedAt = uint64(block.timestamp);
        emit MilestoneApproved(id, m);
    }

    /// @param reasonCode Kode alasan numerik; tidak ada teks bebas di on-chain (REQ-09).
    function rejectMilestone(uint256 id, uint8 m, uint8 reasonCode) external whenNotPaused {
        Campaign storage c = _campaign(id);
        _onlyActiveVerifier(c);
        if (c.status != CampaignStatus.Active) revert WrongState();
        Milestone storage ms = _milestone(id, c, m);
        if (ms.status != MilestoneStatus.Submitted) revert WrongState();
        ms.status = MilestoneStatus.Rejected;
        emit MilestoneRejected(id, m, reasonCode);
    }

    /// @notice Bila verifikator tidak merespons, milestone naik ke Escalated. Tidak ada pelepasan otomatis (REQ-15).
    function escalate(uint256 id, uint8 m) external whenNotPaused {
        Campaign storage c = _campaign(id);
        if (c.status != CampaignStatus.Active) revert WrongState();
        Milestone storage ms = _milestone(id, c, m);
        if (ms.status != MilestoneStatus.Submitted) revert WrongState();
        if (block.timestamp < uint256(ms.submittedAt) + campaignWindows[id].verification) revert VerificationWindowNotElapsed();
        ms.status = MilestoneStatus.Escalated;
        emit MilestoneEscalated(id, m);
    }

    /// @notice Pelepasan setelah challenge window (REQ-16). Dana masuk saldo claimable (pola pull).
    function release(uint256 id, uint8 m) external whenNotPaused {
        Campaign storage c = _campaign(id);
        if (c.status != CampaignStatus.Active) revert WrongState();
        Milestone storage ms = _milestone(id, c, m);
        if (ms.status != MilestoneStatus.Approved) revert WrongState();
        if (block.timestamp < uint256(ms.approvedAt) + campaignWindows[id].challenge) revert ChallengeWindowOpen();

        bool last = (m == c.milestoneCount - 1);
        // Milestone terakhir menerima sisa agar pembulatan tidak menyisakan dana tertahan.
        uint256 gross = last ? c.totalRaised - c.releasedGross : (c.totalRaised * ms.shareBps) / BPS;
        uint256 op = (gross * c.opCostBps) / BPS;

        ms.status = MilestoneStatus.Released; // efek sebelum interaksi
        c.releasedGross += gross;
        claimable[c.executor] += gross - op;
        claimable[c.organizer] += op;
        emit MilestoneReleased(id, m, gross - op, op);

        if (last) {
            c.status = CampaignStatus.Completed;
            emit CampaignCompleted(id);
        }
    }

    // ---------------------------------------------------------------------
    // Sengketa, pembatalan, penggantian verifikator
    // ---------------------------------------------------------------------

    /// @notice Regulator, atau donatur yang kontribusinya mencapai ambang, membekukan kampanye.
    ///         Sengaja tidak dibatasi pause: ini aksi pelindung.
    function openDispute(uint256 id) external {
        Campaign storage c = _campaign(id);
        if (c.status != CampaignStatus.Active) revert WrongState();
        if (msg.sender != regulator) {
            if (contributions[id][msg.sender] * BPS < c.totalRaised * disputeThresholdBps) {
                revert DisputeThresholdNotMet();
            }
            if (disputeUsed[id][msg.sender]) revert DisputeAlreadyUsed();
            disputeUsed[id][msg.sender] = true;
        }
        c.status = CampaignStatus.Disputed;
        emit DisputeOpened(id, msg.sender);
    }

    /// @param resume true: kampanye kembali Active. false: kampanye Cancelled (donatur refund pro-rata).
    /// @param decisionHash Hash dokumen keputusan yang disimpan off-chain.
    function resolveDispute(uint256 id, bool resume, bytes32 decisionHash) external onlyRegulator {
        Campaign storage c = _campaign(id);
        if (c.status != CampaignStatus.Disputed) revert WrongState();
        if (decisionHash == bytes32(0)) revert ZeroHash(); // mitigasi A-04: keputusan wajib berdokumen
        c.status = resume ? CampaignStatus.Active : CampaignStatus.Cancelled;
        if (resume) {
            // Mitigasi A-05: jendela verifikasi tidak berjalan selama sengketa,
            // sehingga verifikator mendapat waktu penuh setelah kampanye dilanjutkan.
            for (uint8 i = 0; i < c.milestoneCount; ++i) {
                Milestone storage ms = _milestones[id][i];
                if (ms.status == MilestoneStatus.Submitted) ms.submittedAt = uint64(block.timestamp);
            }
        }
        emit DisputeResolved(id, resume, decisionHash);
    }

    function cancelCampaign(uint256 id) external {
        Campaign storage c = _campaign(id);
        if (
            c.status != CampaignStatus.Funding &&
            c.status != CampaignStatus.Active &&
            c.status != CampaignStatus.Disputed
        ) revert WrongState();
        if (msg.sender != regulator) {
            if (msg.sender != c.organizer) revert NotOrganizer();
            if (c.status != CampaignStatus.Funding) revert WrongState();
        }
        c.status = CampaignStatus.Cancelled;
        emit CampaignCancelled(id, msg.sender);
    }

    /// @notice Mengganti verifikator tanpa mengubah dana atau riwayat (REQ-11).
    ///         Milestone Submitted atau Escalated mendapat jendela verifikasi baru.
    function replaceVerifier(uint256 id, address newVerifier) external onlyRegulator {
        Campaign storage c = _campaign(id);
        if (
            c.status != CampaignStatus.Funding &&
            c.status != CampaignStatus.Active &&
            c.status != CampaignStatus.Disputed
        ) revert WrongState();
        if (newVerifier == address(0)) revert InvalidParams();
        if (newVerifier == c.organizer || newVerifier == c.executor) revert RoleConflict();
        if (!approvedVerifiers[newVerifier]) revert VerifierNotApproved();

        address old = c.verifier;
        c.verifier = newVerifier;
        for (uint8 i = 0; i < c.milestoneCount; ++i) {
            Milestone storage ms = _milestones[id][i];
            if (ms.status == MilestoneStatus.Submitted || ms.status == MilestoneStatus.Escalated) {
                ms.status = MilestoneStatus.Submitted;
                ms.submittedAt = uint64(block.timestamp);
            }
        }
        emit VerifierReplaced(id, old, newVerifier);
    }

    // ---------------------------------------------------------------------
    // Penarikan dana
    // ---------------------------------------------------------------------

    /// @notice Refund proporsional. Tetap berfungsi saat pause (REQ-12).
    ///         Failed: refund penuh. Cancelled: sisa escrow dibagi pro-rata; pembulatan ke bawah
    ///         menyisakan sedikit debu di kontrak, tidak pernah kekurangan.
    function refund(uint256 id) external nonReentrant {
        Campaign storage c = _campaign(id);
        if (c.status != CampaignStatus.Failed && c.status != CampaignStatus.Cancelled) revert WrongState();
        if (refunded[id][msg.sender]) revert AlreadyRefunded();
        uint256 amount = contributions[id][msg.sender];
        if (amount == 0) revert NothingToRefund();

        uint256 due = c.status == CampaignStatus.Failed
            ? amount
            : (amount * (c.totalRaised - c.releasedGross)) / c.totalRaised;

        refunded[id][msg.sender] = true; // efek sebelum interaksi
        emit Refunded(id, msg.sender, due);
        if (due > 0) {
            (bool ok, ) = msg.sender.call{value: due}("");
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice Menarik saldo hasil pelepasan milestone (pelaksana atau organizer).
    function withdraw() external nonReentrant whenNotPaused {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        claimable[msg.sender] = 0; // efek sebelum interaksi
        emit Withdrawn(msg.sender, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ---------------------------------------------------------------------
    // Pembacaan (REQ-05)
    // ---------------------------------------------------------------------

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        return _campaign(id);
    }

    function getMilestone(uint256 id, uint8 m) external view returns (Milestone memory) {
        Campaign storage c = _campaign(id);
        return _milestone(id, c, m);
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _campaign(uint256 id) internal view returns (Campaign storage c) {
        c = _campaigns[id];
        if (c.organizer == address(0)) revert CampaignNotFound();
    }

    function _milestone(uint256 id, Campaign storage c, uint8 m) internal view returns (Milestone storage) {
        if (m >= c.milestoneCount) revert InvalidMilestone();
        return _milestones[id][m];
    }

    /// @dev Verifikator harus verifikator kampanye DAN masih disetujui Regulator,
    ///      sehingga pencabutan persetujuan berlaku seketika (mitigasi R-02).
    function _onlyActiveVerifier(Campaign storage c) internal view {
        if (msg.sender != c.verifier || !approvedVerifiers[msg.sender]) revert NotVerifier();
    }

    function _validateShares(uint16[] calldata shares) internal pure {
        if (shares.length == 0 || shares.length > MAX_MILESTONES) revert InvalidMilestoneCount();
        uint256 total;
        for (uint256 i = 0; i < shares.length; ++i) {
            if (shares[i] == 0) revert InvalidMilestoneShares();
            total += shares[i];
        }
        if (total != BPS) revert InvalidMilestoneShares();
    }
}
