// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolFactory} from "./interfaces/IPoolFactory.sol";

/**
 * @title CrisisPool
 * @notice Escrow contract for a single humanitarian crisis. Holds donated USDC
 *         and releases funds immediately to admin-verified, admin-assigned NGOs
 *         upon verifier approval. Enforces immutable per-claim, daily, and
 *         per-NGO-total spending caps.
 *
 * @dev Deployed exclusively by PoolFactory. Pool ID = this contract's address.
 *      All metadata (name, region, description) lives off-chain.
 *
 * Security model:
 *   - Funds ONLY leave via releaseFunds() → usdc.transfer(ngo, amount)
 *   - No withdrawal, no closePool, no admin override for fund movement
 *   - Caps are immutable (set in constructor, never changeable)
 *   - Checks-effects-interactions pattern on every external call
 */
contract CrisisPool {
    // -----------------------------------------------------------------------
    //  Errors
    // -----------------------------------------------------------------------

    error OnlyAdmin();
    error OnlyVerifier();
    error DonationsPaused();
    error ZeroAmount();
    error NGONotVerified();
    error NGONotAssigned();
    error NGOAlreadyAssigned();
    error ExceedsMaxPerClaim();
    error ExceedsDailyLimit();
    error ExceedsPoolLimit();
    error InsufficientPoolBalance();
    error ProofAlreadyUsed();
    error TransferFailed();

    // -----------------------------------------------------------------------
    //  Events
    // -----------------------------------------------------------------------

    event DonationReceived(address indexed donor, uint256 amount);
    event NGOAssigned(address indexed ngo);
    event FundsReleased(address indexed ngo, uint256 amount, bytes32 proofId);
    event DonationsPausedEvent();
    event DonationsResumedEvent();

    // -----------------------------------------------------------------------
    //  Immutable state (set once in constructor)
    // -----------------------------------------------------------------------

    uint256 public immutable maxPerClaim;
    uint256 public immutable maxPerNGOPerDay;
    uint256 public immutable maxPerNGOPool;
    IERC20 public immutable usdc;
    address public immutable factory;
    address public immutable admin;
    address public immutable verifier;

    // -----------------------------------------------------------------------
    //  Mutable state
    // -----------------------------------------------------------------------

    bool public donationsPaused;
    uint256 public totalDonated;
    uint256 public totalReleased;

    /// @notice NGOs assigned to this pool by admin.
    mapping(address => bool) public assignedNGOs;

    /// @notice Lifetime amount claimed by each NGO from this pool.
    mapping(address => uint256) public totalClaimedByNGO;

    /// @notice Amount claimed by each NGO on their last active day.
    mapping(address => uint256) public dailyClaimedByNGO;

    /// @notice The UTC day number of the last claim by each NGO.
    mapping(address => uint256) public lastClaimDayByNGO;

    /// @notice Tracks used proof IDs to prevent duplicate releases.
    mapping(bytes32 => bool) public usedProofIds;

    // -----------------------------------------------------------------------
    //  Modifiers
    // -----------------------------------------------------------------------

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    modifier onlyVerifier() {
        if (msg.sender != verifier) revert OnlyVerifier();
        _;
    }

    modifier whenDonationsNotPaused() {
        if (donationsPaused) revert DonationsPaused();
        _;
    }

    // -----------------------------------------------------------------------
    //  Constructor
    // -----------------------------------------------------------------------

    /**
     * @param _maxPerClaim     Max USDC (6 decimals) per single release.
     * @param _maxPerNGOPerDay Max USDC an NGO can receive per UTC day.
     * @param _maxPerNGOPool   Max USDC an NGO can receive from this pool total.
     * @param _usdc            USDC token contract address.
     * @param _factory         PoolFactory address (for isVerified checks).
     * @param _admin           Admin wallet (cold/hardware).
     * @param _verifier        Verifier wallet (backend hot wallet).
     */
    constructor(
        uint256 _maxPerClaim,
        uint256 _maxPerNGOPerDay,
        uint256 _maxPerNGOPool,
        address _usdc,
        address _factory,
        address _admin,
        address _verifier
    ) {
        maxPerClaim = _maxPerClaim;
        maxPerNGOPerDay = _maxPerNGOPerDay;
        maxPerNGOPool = _maxPerNGOPool;
        usdc = IERC20(_usdc);
        factory = _factory;
        admin = _admin;
        verifier = _verifier;
    }

    // -----------------------------------------------------------------------
    //  Donation
    // -----------------------------------------------------------------------

    /**
     * @notice Donate USDC to this crisis pool.
     * @dev Caller must have called usdc.approve(address(this), amount) first.
     * @param amount Amount of USDC (6 decimals) to donate.
     */
    function donate(uint256 amount) external whenDonationsNotPaused {
        if (amount == 0) revert ZeroAmount();

        // Effects
        totalDonated += amount;

        // Interactions
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        emit DonationReceived(msg.sender, amount);
    }

    // -----------------------------------------------------------------------
    //  NGO Assignment
    // -----------------------------------------------------------------------

    /**
     * @notice Assign a verified NGO to this pool. Only admin can call.
     *         The NGO must already be verified in the PoolFactory.
     * @param ngo Wallet address of the NGO.
     */
    function assignNGO(address ngo) external onlyAdmin {
        if (!IPoolFactory(factory).isVerified(ngo)) revert NGONotVerified();
        if (assignedNGOs[ngo]) revert NGOAlreadyAssigned();

        assignedNGOs[ngo] = true;

        emit NGOAssigned(ngo);
    }

    // -----------------------------------------------------------------------
    //  Fund Release (immediate transfer)
    // -----------------------------------------------------------------------

    /**
     * @notice Release USDC to an assigned NGO. Called by the backend verifier
     *         after proof passes off-chain verification. Funds are transferred
     *         immediately — no timelock or challenge period.
     *
     * @param ngo     Recipient NGO wallet address.
     * @param amount  Amount of USDC (6 decimals) to release.
     * @param proofId Unique identifier for the proof that justified this release.
     */
    function releaseFunds(address ngo, uint256 amount, bytes32 proofId) external onlyVerifier {
        // --- Checks ---
        if (!IPoolFactory(factory).isVerified(ngo)) revert NGONotVerified();
        if (!assignedNGOs[ngo]) revert NGONotAssigned();
        if (amount == 0) revert ZeroAmount();
        if (amount > maxPerClaim) revert ExceedsMaxPerClaim();
        if (getDailyClaimedAmount(ngo) + amount > maxPerNGOPerDay) revert ExceedsDailyLimit();
        if (totalClaimedByNGO[ngo] + amount > maxPerNGOPool) revert ExceedsPoolLimit();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientPoolBalance();
        if (usedProofIds[proofId]) revert ProofAlreadyUsed();

        // --- Effects ---
        usedProofIds[proofId] = true;

        // Daily tracking: reset if new day
        uint256 currentDay = _getCurrentDay();
        if (lastClaimDayByNGO[ngo] != currentDay) {
            dailyClaimedByNGO[ngo] = 0;
            lastClaimDayByNGO[ngo] = currentDay;
        }
        dailyClaimedByNGO[ngo] += amount;
        totalClaimedByNGO[ngo] += amount;
        totalReleased += amount;

        // --- Interactions ---
        bool success = usdc.transfer(ngo, amount);
        if (!success) revert TransferFailed();

        emit FundsReleased(ngo, amount, proofId);
    }

    // -----------------------------------------------------------------------
    //  Donation Pausing
    // -----------------------------------------------------------------------

    /// @notice Pause new donations. Does NOT affect existing funds or releases.
    function pauseDonations() external onlyAdmin {
        donationsPaused = true;
        emit DonationsPausedEvent();
    }

    /// @notice Resume donations.
    function resumeDonations() external onlyAdmin {
        donationsPaused = false;
        emit DonationsResumedEvent();
    }

    // -----------------------------------------------------------------------
    //  View Functions
    // -----------------------------------------------------------------------

    /// @notice Actual USDC balance held by this pool.
    function getPoolBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get the amount an NGO has claimed today (UTC).
     *         Returns 0 if no claims have been made today.
     * @param ngo The NGO address to query.
     */
    function getDailyClaimedAmount(address ngo) public view returns (uint256) {
        if (lastClaimDayByNGO[ngo] != _getCurrentDay()) {
            return 0; // new day, counter reset
        }
        return dailyClaimedByNGO[ngo];
    }

    // -----------------------------------------------------------------------
    //  Internal Helpers
    // -----------------------------------------------------------------------

    /// @dev Returns the current UTC day number (block.timestamp / 86400).
    function _getCurrentDay() internal view returns (uint256) {
        return block.timestamp / 86400;
    }
}
