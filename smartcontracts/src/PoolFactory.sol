// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CrisisPool} from "./CrisisPool.sol";
import {IPoolFactory} from "./interfaces/IPoolFactory.sol";

/**
 * @title PoolFactory
 * @notice Single global contract that serves as:
 *         1. NGO registry — admin-managed whitelist of verified NGO wallets
 *         2. Pool deployer — deploys isolated CrisisPool escrow contracts
 *
 * @dev Deployment: deploy once with admin, verifier, and USDC addresses.
 *      Then admin calls deployPool() for each crisis.
 *
 * Security model:
 *   - Only admin can modify the NGO whitelist or deploy pools
 *   - Admin role is non-transferable and non-renounceable (MVP)
 *   - Revoking an NGO immediately blocks releaseFunds() in ALL pools
 *     (CrisisPool checks isVerified at release-time, not just at assignment)
 *   - Factory hardcodes its own address, admin, verifier, and USDC into every
 *     pool it deploys — no way to deploy a pool with spoofed roles
 *   - This contract never holds any funds
 */
contract PoolFactory is IPoolFactory {
    // -----------------------------------------------------------------------
    //  Errors
    // -----------------------------------------------------------------------

    error OnlyAdmin();
    error ZeroAddress();
    error NGOAlreadyVerified();
    error NGONotVerified();
    error InvalidCapConfig();
    error AdminVerifierCollision();

    // -----------------------------------------------------------------------
    //  Events
    // -----------------------------------------------------------------------

    /// @notice Emitted when admin adds an NGO to the global whitelist.
    event NGOApproved(address indexed ngo);

    /// @notice Emitted when admin removes an NGO from the global whitelist.
    event NGORevoked(address indexed ngo);

    /**
     * @notice Emitted when a new CrisisPool is deployed.
     * @dev Pool metadata (name, region, description) is NOT stored on-chain.
     *      The backend stores poolAddress in its DB and links metadata there.
     */
    event PoolDeployed(
        address indexed poolAddress,
        uint256 indexed poolIndex,
        uint256 maxPerClaim,
        uint256 maxPerNGOPerDay,
        uint256 maxPerNGOPool
    );

    // -----------------------------------------------------------------------
    //  State
    // -----------------------------------------------------------------------

    /// @notice Admin wallet (cold/hardware). Controls NGO whitelist and pool deployment.
    address public immutable admin;

    /// @notice Verifier wallet (backend hot wallet). Passed to every pool for releaseFunds().
    address public immutable verifier;

    /// @notice USDC token contract. Passed to every pool.
    IERC20 public immutable usdc;

    /// @notice Global NGO whitelist. true = admin-verified.
    mapping(address => bool) public verifiedNGOs;

    /// @notice Tracks all pool addresses deployed by this factory.
    mapping(address => bool) public isPool;

    /// @notice Total number of pools deployed.
    uint256 public poolCount;

    // -----------------------------------------------------------------------
    //  Modifiers
    // -----------------------------------------------------------------------

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    // -----------------------------------------------------------------------
    //  Constructor
    // -----------------------------------------------------------------------

    /**
     * @param _admin    Admin wallet address (cold/hardware wallet).
     * @param _verifier Verifier wallet address (backend hot wallet).
     * @param _usdc     USDC ERC20 token contract address.
     */
    constructor(address _admin, address _verifier, address _usdc) {
        if (_admin == address(0)) revert ZeroAddress();
        if (_verifier == address(0)) revert ZeroAddress();
        if (_usdc == address(0)) revert ZeroAddress();
        // Admin and verifier must be different wallets for role separation
        if (_admin == _verifier) revert AdminVerifierCollision();

        admin = _admin;
        verifier = _verifier;
        usdc = IERC20(_usdc);
    }

    // -----------------------------------------------------------------------
    //  NGO Registry
    // -----------------------------------------------------------------------

    /**
     * @notice Add an NGO wallet to the global whitelist.
     * @dev This is the first gate. The NGO must also be assigned to a specific
     *      pool via CrisisPool.assignNGO() before it can receive funds.
     * @param ngo Wallet address of the NGO.
     */
    function addVerifiedNGO(address ngo) external onlyAdmin {
        if (ngo == address(0)) revert ZeroAddress();
        if (verifiedNGOs[ngo]) revert NGOAlreadyVerified();

        verifiedNGOs[ngo] = true;

        emit NGOApproved(ngo);
    }

    /**
     * @notice Remove an NGO from the global whitelist.
     * @dev Takes effect immediately — any future releaseFunds() call for this
     *      NGO in ANY pool will revert, because CrisisPool checks
     *      factory.isVerified(ngo) at release-time.
     * @param ngo Wallet address of the NGO to revoke.
     */
    function revokeNGO(address ngo) external onlyAdmin {
        if (!verifiedNGOs[ngo]) revert NGONotVerified();

        verifiedNGOs[ngo] = false;

        emit NGORevoked(ngo);
    }

    /**
     * @notice Check if an address is a verified NGO.
     * @dev Called by CrisisPool contracts at release-time. Pure storage read,
     *      no gas cost for external view calls.
     * @param ngo Address to check.
     * @return True if the address is admin-verified.
     */
    function isVerified(address ngo) external view override returns (bool) {
        return verifiedNGOs[ngo];
    }

    // -----------------------------------------------------------------------
    //  Pool Deployment
    // -----------------------------------------------------------------------

    /**
     * @notice Deploy a new CrisisPool escrow contract for a crisis.
     *
     * @dev The factory hardcodes admin, verifier, usdc, and its own address
     *      into every pool. This guarantees:
     *      - Pool roles match the factory's roles (no spoofing)
     *      - Pool can call back to this factory for isVerified() checks
     *      - Pool uses the correct USDC token
     *
     * Cap validation ensures logical consistency:
     *      - A single claim can't exceed the daily limit
     *      - The daily limit can't exceed the total pool limit per NGO
     *
     * @param maxPerClaim     Max USDC (6 decimals) per single releaseFunds() call.
     * @param maxPerNGOPerDay Max USDC an NGO can receive per UTC day from this pool.
     * @param maxPerNGOPool   Max USDC an NGO can receive from this pool in total.
     * @return poolAddress    Address of the newly deployed CrisisPool contract.
     */
    function deployPool(
        uint256 maxPerClaim,
        uint256 maxPerNGOPerDay,
        uint256 maxPerNGOPool
    ) external onlyAdmin returns (address poolAddress) {
        // --- Validation ---
        // maxPerClaim must be > 0
        if (maxPerClaim == 0) revert InvalidCapConfig();
        // A single claim must fit within the daily limit
        if (maxPerNGOPerDay < maxPerClaim) revert InvalidCapConfig();
        // Daily limit must fit within the total pool limit
        if (maxPerNGOPool < maxPerNGOPerDay) revert InvalidCapConfig();

        // --- Deploy ---
        CrisisPool pool = new CrisisPool(
            maxPerClaim,
            maxPerNGOPerDay,
            maxPerNGOPool,
            address(usdc),
            address(this),  // factory = this contract
            admin,
            verifier
        );

        poolAddress = address(pool);

        // --- Track ---
        isPool[poolAddress] = true;
        uint256 currentIndex = poolCount;
        poolCount = currentIndex + 1;

        emit PoolDeployed(
            poolAddress,
            currentIndex,
            maxPerClaim,
            maxPerNGOPerDay,
            maxPerNGOPool
        );
    }
}
