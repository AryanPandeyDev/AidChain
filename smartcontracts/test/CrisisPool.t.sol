// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {PoolFactory} from "../src/PoolFactory.sol";
import {CrisisPool} from "../src/CrisisPool.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/**
 * @title CrisisPoolTest
 * @notice Comprehensive tests for CrisisPool: donations, NGO assignment,
 *         fund releases (caps, daily limits, proof dedup), pause/resume,
 *         and cross-contract NGO revocation.
 */
contract CrisisPoolTest is Test {
    // -----------------------------------------------------------------------
    //  State
    // -----------------------------------------------------------------------

    PoolFactory public factory;
    CrisisPool public pool;
    MockUSDC public usdc;

    address public admin = makeAddr("admin");
    address public verifier = makeAddr("verifier");
    address public ngo1 = makeAddr("ngo1");
    address public ngo2 = makeAddr("ngo2");
    address public donor = makeAddr("donor");
    address public stranger = makeAddr("stranger");

    // Pool caps
    uint256 constant MAX_PER_CLAIM = 1_000e6;       // 1,000 USDC
    uint256 constant MAX_PER_NGO_DAY = 3_000e6;     // 3,000 USDC
    uint256 constant MAX_PER_NGO_POOL = 10_000e6;   // 10,000 USDC

    // Common amounts
    uint256 constant DONATION_AMOUNT = 50_000e6;     // 50,000 USDC
    uint256 constant RELEASE_AMOUNT = 500e6;         // 500 USDC

    // -----------------------------------------------------------------------
    //  Setup
    // -----------------------------------------------------------------------

    function setUp() public {
        // Deploy infrastructure
        usdc = new MockUSDC();
        factory = new PoolFactory(admin, verifier, address(usdc));

        // Deploy a pool via factory
        vm.prank(admin);
        address poolAddr = factory.deployPool(MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
        pool = CrisisPool(poolAddr);

        // Verify and assign NGO1
        vm.startPrank(admin);
        factory.addVerifiedNGO(ngo1);
        pool.assignNGO(ngo1);
        vm.stopPrank();

        // Fund donor with USDC and donate to pool
        usdc.mint(donor, DONATION_AMOUNT);
        vm.startPrank(donor);
        usdc.approve(address(pool), DONATION_AMOUNT);
        pool.donate(DONATION_AMOUNT);
        vm.stopPrank();
    }

    // -----------------------------------------------------------------------
    //  Constructor / Immutables
    // -----------------------------------------------------------------------

    function test_constructor_setsImmutables() public view {
        assertEq(pool.maxPerClaim(), MAX_PER_CLAIM);
        assertEq(pool.maxPerNGOPerDay(), MAX_PER_NGO_DAY);
        assertEq(pool.maxPerNGOPool(), MAX_PER_NGO_POOL);
        assertEq(address(pool.usdc()), address(usdc));
        assertEq(pool.factory(), address(factory));
        assertEq(pool.admin(), admin);
        assertEq(pool.verifier(), verifier);
    }

    // =======================================================================
    //  DONATIONS
    // =======================================================================

    function test_donate_success() public {
        address donor2 = makeAddr("donor2");
        usdc.mint(donor2, 1_000e6);

        vm.startPrank(donor2);
        usdc.approve(address(pool), 1_000e6);
        pool.donate(1_000e6);
        vm.stopPrank();

        assertEq(pool.totalDonated(), DONATION_AMOUNT + 1_000e6);
    }

    function test_donate_emitsEvent() public {
        address donor2 = makeAddr("donor2");
        usdc.mint(donor2, 1_000e6);

        vm.startPrank(donor2);
        usdc.approve(address(pool), 1_000e6);

        vm.expectEmit(true, false, false, true);
        emit CrisisPool.DonationReceived(donor2, 1_000e6);
        pool.donate(1_000e6);
        vm.stopPrank();
    }

    function test_donate_revertsOnZeroAmount() public {
        vm.prank(donor);
        vm.expectRevert(CrisisPool.ZeroAmount.selector);
        pool.donate(0);
    }

    function test_donate_revertsWithoutApproval() public {
        address donor2 = makeAddr("donor2");
        usdc.mint(donor2, 1_000e6);

        vm.prank(donor2);
        vm.expectRevert(); // ERC20 insufficient allowance
        pool.donate(1_000e6);
    }

    function test_donate_revertsWhenPaused() public {
        vm.prank(admin);
        pool.pauseDonations();

        address donor2 = makeAddr("donor2");
        usdc.mint(donor2, 1_000e6);
        vm.startPrank(donor2);
        usdc.approve(address(pool), 1_000e6);

        vm.expectRevert(CrisisPool.DonationsPaused.selector);
        pool.donate(1_000e6);
        vm.stopPrank();
    }

    function test_donate_succeedsAfterResume() public {
        vm.prank(admin);
        pool.pauseDonations();
        vm.prank(admin);
        pool.resumeDonations();

        address donor2 = makeAddr("donor2");
        usdc.mint(donor2, 1_000e6);
        vm.startPrank(donor2);
        usdc.approve(address(pool), 1_000e6);
        pool.donate(1_000e6);
        vm.stopPrank();

        assertEq(pool.totalDonated(), DONATION_AMOUNT + 1_000e6);
    }

    function test_donate_updatesTotalDonated() public view {
        assertEq(pool.totalDonated(), DONATION_AMOUNT);
    }

    function test_donate_updatesPoolBalance() public view {
        assertEq(pool.getPoolBalance(), DONATION_AMOUNT);
    }

    // =======================================================================
    //  NGO ASSIGNMENT
    // =======================================================================

    function test_assignNGO_success() public {
        vm.prank(admin);
        factory.addVerifiedNGO(ngo2);

        vm.prank(admin);
        pool.assignNGO(ngo2);

        assertTrue(pool.assignedNGOs(ngo2));
    }

    function test_assignNGO_emitsEvent() public {
        vm.prank(admin);
        factory.addVerifiedNGO(ngo2);

        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit CrisisPool.NGOAssigned(ngo2);
        pool.assignNGO(ngo2);
    }

    function test_assignNGO_revertsForNonAdmin() public {
        vm.prank(admin);
        factory.addVerifiedNGO(ngo2);

        vm.prank(stranger);
        vm.expectRevert(CrisisPool.OnlyAdmin.selector);
        pool.assignNGO(ngo2);
    }

    function test_assignNGO_revertsForVerifier() public {
        vm.prank(admin);
        factory.addVerifiedNGO(ngo2);

        vm.prank(verifier);
        vm.expectRevert(CrisisPool.OnlyAdmin.selector);
        pool.assignNGO(ngo2);
    }

    function test_assignNGO_revertsIfNotVerified() public {
        vm.prank(admin);
        vm.expectRevert(CrisisPool.NGONotVerified.selector);
        pool.assignNGO(ngo2); // ngo2 not verified in factory
    }

    function test_assignNGO_revertsIfAlreadyAssigned() public {
        // ngo1 already assigned in setUp
        vm.prank(admin);
        vm.expectRevert(CrisisPool.NGOAlreadyAssigned.selector);
        pool.assignNGO(ngo1);
    }

    function test_assignNGO_multipleNGOsToSamePool() public {
        vm.startPrank(admin);
        factory.addVerifiedNGO(ngo2);
        pool.assignNGO(ngo2);
        vm.stopPrank();

        assertTrue(pool.assignedNGOs(ngo1));
        assertTrue(pool.assignedNGOs(ngo2));
    }

    // =======================================================================
    //  FUND RELEASE — Happy Path
    // =======================================================================

    function test_releaseFunds_success() public {
        bytes32 proofId = keccak256("proof-001");

        vm.prank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, proofId);

        assertEq(usdc.balanceOf(ngo1), RELEASE_AMOUNT);
        assertEq(pool.totalReleased(), RELEASE_AMOUNT);
        assertEq(pool.totalClaimedByNGO(ngo1), RELEASE_AMOUNT);
        assertEq(pool.getPoolBalance(), DONATION_AMOUNT - RELEASE_AMOUNT);
        assertTrue(pool.usedProofIds(proofId));
    }

    function test_releaseFunds_emitsEvent() public {
        bytes32 proofId = keccak256("proof-001");

        vm.prank(verifier);
        vm.expectEmit(true, false, false, true);
        emit CrisisPool.FundsReleased(ngo1, RELEASE_AMOUNT, proofId);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, proofId);
    }

    function test_releaseFunds_multipleReleasesToSameNGO() public {
        vm.startPrank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof-001"));
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof-002"));
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof-003"));
        vm.stopPrank();

        assertEq(usdc.balanceOf(ngo1), RELEASE_AMOUNT * 3);
        assertEq(pool.totalClaimedByNGO(ngo1), RELEASE_AMOUNT * 3);
        assertEq(pool.totalReleased(), RELEASE_AMOUNT * 3);
    }

    function test_releaseFunds_exactMaxPerClaim() public {
        bytes32 proofId = keccak256("proof-max");

        vm.prank(verifier);
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, proofId);

        assertEq(usdc.balanceOf(ngo1), MAX_PER_CLAIM);
    }

    // =======================================================================
    //  FUND RELEASE — Access Control
    // =======================================================================

    function test_releaseFunds_revertsForNonVerifier() public {
        vm.prank(stranger);
        vm.expectRevert(CrisisPool.OnlyVerifier.selector);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof"));
    }

    function test_releaseFunds_revertsForAdmin() public {
        vm.prank(admin);
        vm.expectRevert(CrisisPool.OnlyVerifier.selector);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof"));
    }

    // =======================================================================
    //  FUND RELEASE — Validation Checks
    // =======================================================================

    function test_releaseFunds_revertsForUnverifiedNGO() public {
        // ngo2 is not verified in factory
        vm.prank(verifier);
        vm.expectRevert(CrisisPool.NGONotVerified.selector);
        pool.releaseFunds(ngo2, RELEASE_AMOUNT, keccak256("proof"));
    }

    function test_releaseFunds_revertsForUnassignedNGO() public {
        // Verify ngo2 in factory but don't assign to pool
        vm.prank(admin);
        factory.addVerifiedNGO(ngo2);

        vm.prank(verifier);
        vm.expectRevert(CrisisPool.NGONotAssigned.selector);
        pool.releaseFunds(ngo2, RELEASE_AMOUNT, keccak256("proof"));
    }

    function test_releaseFunds_revertsOnZeroAmount() public {
        vm.prank(verifier);
        vm.expectRevert(CrisisPool.ZeroAmount.selector);
        pool.releaseFunds(ngo1, 0, keccak256("proof"));
    }

    function test_releaseFunds_revertsAboveMaxPerClaim() public {
        vm.prank(verifier);
        vm.expectRevert(CrisisPool.ExceedsMaxPerClaim.selector);
        pool.releaseFunds(ngo1, MAX_PER_CLAIM + 1, keccak256("proof"));
    }

    function test_releaseFunds_revertsOnDuplicateProofId() public {
        bytes32 proofId = keccak256("proof-dup");

        vm.startPrank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, proofId);

        vm.expectRevert(CrisisPool.ProofAlreadyUsed.selector);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, proofId);
        vm.stopPrank();
    }

    function test_releaseFunds_revertsOnInsufficientBalance() public {
        // Deploy a new pool with no donations
        vm.prank(admin);
        address emptyPoolAddr = factory.deployPool(MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
        CrisisPool emptyPool = CrisisPool(emptyPoolAddr);

        vm.prank(admin);
        emptyPool.assignNGO(ngo1);

        vm.prank(verifier);
        vm.expectRevert(CrisisPool.InsufficientPoolBalance.selector);
        emptyPool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof"));
    }

    // =======================================================================
    //  FUND RELEASE — Daily Limit
    // =======================================================================

    function test_releaseFunds_dailyLimitEnforced() public {
        vm.startPrank(verifier);
        // Release 3x 1000 = 3000 (exactly daily limit)
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256("proof-1"));
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256("proof-2"));
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256("proof-3"));

        // Next release should exceed daily limit
        vm.expectRevert(CrisisPool.ExceedsDailyLimit.selector);
        pool.releaseFunds(ngo1, 1, keccak256("proof-4"));
        vm.stopPrank();
    }

    function test_releaseFunds_dailyLimitResetsNextDay() public {
        vm.startPrank(verifier);
        // Fill up today's daily limit
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256("proof-1"));
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256("proof-2"));
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256("proof-3"));
        vm.stopPrank();

        assertEq(pool.getDailyClaimedAmount(ngo1), MAX_PER_NGO_DAY);

        // Warp to next UTC day
        vm.warp(block.timestamp + 1 days);

        // Daily counter should be reset
        assertEq(pool.getDailyClaimedAmount(ngo1), 0);

        // Should be able to release again
        vm.prank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof-day2"));

        assertEq(pool.getDailyClaimedAmount(ngo1), RELEASE_AMOUNT);
    }

    function test_releaseFunds_dailyClaimsAccumulateWithinDay() public {
        vm.startPrank(verifier);
        pool.releaseFunds(ngo1, 400e6, keccak256("proof-1"));
        assertEq(pool.getDailyClaimedAmount(ngo1), 400e6);

        pool.releaseFunds(ngo1, 600e6, keccak256("proof-2"));
        assertEq(pool.getDailyClaimedAmount(ngo1), 1_000e6);
        vm.stopPrank();
    }

    // =======================================================================
    //  FUND RELEASE — Pool (Total) Limit
    // =======================================================================

    function test_releaseFunds_poolLimitEnforced() public {
        // Total pool limit = 10,000. Daily limit = 3,000.
        // Need to spread across multiple days to hit pool limit.
        vm.startPrank(verifier);

        uint256 totalSent = 0;
        uint256 proofCounter = 0;

        // Day 1: send 3,000
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256(abi.encodePacked(proofCounter++))); // 1000
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256(abi.encodePacked(proofCounter++))); // 2000
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256(abi.encodePacked(proofCounter++))); // 3000
        totalSent += MAX_PER_NGO_DAY;
        vm.warp(block.timestamp + 1 days);

        // Day 2: send 3,000
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256(abi.encodePacked(proofCounter++))); // 4000
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256(abi.encodePacked(proofCounter++))); // 5000
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256(abi.encodePacked(proofCounter++))); // 6000
        totalSent += MAX_PER_NGO_DAY;
        vm.warp(block.timestamp + 1 days);

        // Day 3: send 3,000
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256(abi.encodePacked(proofCounter++))); // 7000
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256(abi.encodePacked(proofCounter++))); // 8000
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256(abi.encodePacked(proofCounter++))); // 9000
        totalSent += MAX_PER_NGO_DAY;
        vm.warp(block.timestamp + 1 days);

        // Day 4: can only send 1,000 more (10,000 - 9,000)
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256(abi.encodePacked(proofCounter++))); // 10000
        totalSent += MAX_PER_CLAIM;

        assertEq(pool.totalClaimedByNGO(ngo1), MAX_PER_NGO_POOL);

        // Next one should hit pool limit
        vm.expectRevert(CrisisPool.ExceedsPoolLimit.selector);
        pool.releaseFunds(ngo1, 1, keccak256(abi.encodePacked(proofCounter++)));

        vm.stopPrank();
    }

    // =======================================================================
    //  FUND RELEASE — NGO Revocation (Cross-Contract)
    // =======================================================================

    function test_releaseFunds_revertsAfterNGORevoked() public {
        // Release should work initially
        vm.prank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof-before"));

        // Admin revokes NGO from factory
        vm.prank(admin);
        factory.revokeNGO(ngo1);

        // Release should now revert
        vm.prank(verifier);
        vm.expectRevert(CrisisPool.NGONotVerified.selector);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof-after"));
    }

    function test_releaseFunds_ngoStillAssignedAfterFactoryRevoke() public {
        vm.prank(admin);
        factory.revokeNGO(ngo1);

        // NGO is still "assigned" in the pool, but release is blocked
        // because isVerified check happens first
        assertTrue(pool.assignedNGOs(ngo1));
    }

    // =======================================================================
    //  DONATION PAUSING
    // =======================================================================

    function test_pauseDonations_success() public {
        vm.prank(admin);
        pool.pauseDonations();
        assertTrue(pool.donationsPaused());
    }

    function test_pauseDonations_emitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(false, false, false, false);
        emit CrisisPool.DonationsPausedEvent();
        pool.pauseDonations();
    }

    function test_pauseDonations_revertsForNonAdmin() public {
        vm.prank(stranger);
        vm.expectRevert(CrisisPool.OnlyAdmin.selector);
        pool.pauseDonations();
    }

    function test_resumeDonations_success() public {
        vm.prank(admin);
        pool.pauseDonations();

        vm.prank(admin);
        pool.resumeDonations();
        assertFalse(pool.donationsPaused());
    }

    function test_resumeDonations_emitsEvent() public {
        vm.prank(admin);
        pool.pauseDonations();

        vm.prank(admin);
        vm.expectEmit(false, false, false, false);
        emit CrisisPool.DonationsResumedEvent();
        pool.resumeDonations();
    }

    function test_resumeDonations_revertsForNonAdmin() public {
        vm.prank(stranger);
        vm.expectRevert(CrisisPool.OnlyAdmin.selector);
        pool.resumeDonations();
    }

    function test_pauseDoesNotAffectReleases() public {
        vm.prank(admin);
        pool.pauseDonations();

        // Releases should still work even when donations are paused
        vm.prank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof-while-paused"));

        assertEq(usdc.balanceOf(ngo1), RELEASE_AMOUNT);
    }

    // =======================================================================
    //  VIEW FUNCTIONS
    // =======================================================================

    function test_getPoolBalance_reflectsActualUSDC() public view {
        assertEq(pool.getPoolBalance(), DONATION_AMOUNT);
    }

    function test_getPoolBalance_decreasesAfterRelease() public {
        vm.prank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof"));

        assertEq(pool.getPoolBalance(), DONATION_AMOUNT - RELEASE_AMOUNT);
    }

    function test_getDailyClaimedAmount_returnsZeroForNewNGO() public view {
        assertEq(pool.getDailyClaimedAmount(ngo2), 0);
    }

    function test_getDailyClaimedAmount_returnsZeroOnNewDay() public {
        vm.prank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof"));

        assertEq(pool.getDailyClaimedAmount(ngo1), RELEASE_AMOUNT);

        vm.warp(block.timestamp + 1 days);
        assertEq(pool.getDailyClaimedAmount(ngo1), 0);
    }

    // =======================================================================
    //  ACCOUNTING INTEGRITY
    // =======================================================================

    function test_accounting_totalDonatedMinusReleasedMatchesBalance() public {
        vm.startPrank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof-1"));
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof-2"));
        vm.stopPrank();

        uint256 expectedBalance = pool.totalDonated() - pool.totalReleased();
        assertEq(pool.getPoolBalance(), expectedBalance);
    }

    function test_accounting_directTransferDoesNotBreak() public {
        // Directly send USDC to pool (bypassing donate())
        usdc.mint(address(pool), 5_000e6);

        // totalDonated should NOT change
        assertEq(pool.totalDonated(), DONATION_AMOUNT);

        // But getPoolBalance should reflect actual balance
        assertEq(pool.getPoolBalance(), DONATION_AMOUNT + 5_000e6);

        // Releases should still work
        vm.prank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof"));
        assertEq(usdc.balanceOf(ngo1), RELEASE_AMOUNT);
    }

    // =======================================================================
    //  EDGE CASES
    // =======================================================================

    function test_differentNGOsHaveIndependentCaps() public {
        vm.startPrank(admin);
        factory.addVerifiedNGO(ngo2);
        pool.assignNGO(ngo2);
        vm.stopPrank();

        vm.startPrank(verifier);
        // Fill ngo1's daily limit
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256("ngo1-proof-1"));
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256("ngo1-proof-2"));
        pool.releaseFunds(ngo1, MAX_PER_CLAIM, keccak256("ngo1-proof-3"));

        // ngo1 is at daily limit
        vm.expectRevert(CrisisPool.ExceedsDailyLimit.selector);
        pool.releaseFunds(ngo1, 1, keccak256("ngo1-proof-4"));

        // ngo2 should still be able to release (independent caps)
        pool.releaseFunds(ngo2, RELEASE_AMOUNT, keccak256("ngo2-proof-1"));
        assertEq(usdc.balanceOf(ngo2), RELEASE_AMOUNT);
        vm.stopPrank();
    }

    function test_sameProofIdDifferentNGOsStillReverts() public {
        vm.startPrank(admin);
        factory.addVerifiedNGO(ngo2);
        pool.assignNGO(ngo2);
        vm.stopPrank();

        bytes32 proofId = keccak256("shared-proof");

        vm.startPrank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, proofId);

        // Same proofId for different NGO should still revert
        vm.expectRevert(CrisisPool.ProofAlreadyUsed.selector);
        pool.releaseFunds(ngo2, RELEASE_AMOUNT, proofId);
        vm.stopPrank();
    }

    function test_poolIsolation_separateBalances() public {
        // Deploy a second pool
        vm.prank(admin);
        address pool2Addr = factory.deployPool(MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
        CrisisPool pool2 = CrisisPool(pool2Addr);

        vm.prank(admin);
        pool2.assignNGO(ngo1);

        // Pool2 has no funds
        assertEq(pool2.getPoolBalance(), 0);

        // Release from pool2 should fail — no balance
        vm.prank(verifier);
        vm.expectRevert(CrisisPool.InsufficientPoolBalance.selector);
        pool2.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof"));

        // Pool1 should still work fine
        vm.prank(verifier);
        pool.releaseFunds(ngo1, RELEASE_AMOUNT, keccak256("proof"));
        assertEq(usdc.balanceOf(ngo1), RELEASE_AMOUNT);
    }
}
