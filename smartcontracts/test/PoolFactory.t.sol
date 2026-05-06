// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {PoolFactory} from "../src/PoolFactory.sol";
import {CrisisPool} from "../src/CrisisPool.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/**
 * @title PoolFactoryTest
 * @notice Comprehensive tests for PoolFactory: constructor validation,
 *         NGO registry (add/revoke), and pool deployment with cap validation.
 */
contract PoolFactoryTest is Test {
    // -----------------------------------------------------------------------
    //  State
    // -----------------------------------------------------------------------

    PoolFactory public factory;
    MockUSDC public usdc;

    address public admin = makeAddr("admin");
    address public verifier = makeAddr("verifier");
    address public ngo1 = makeAddr("ngo1");
    address public ngo2 = makeAddr("ngo2");
    address public stranger = makeAddr("stranger");

    // Standard pool caps for tests (USDC has 6 decimals)
    uint256 constant MAX_PER_CLAIM = 1_000e6;       // 1,000 USDC
    uint256 constant MAX_PER_NGO_DAY = 5_000e6;     // 5,000 USDC
    uint256 constant MAX_PER_NGO_POOL = 50_000e6;   // 50,000 USDC

    // -----------------------------------------------------------------------
    //  Setup
    // -----------------------------------------------------------------------

    function setUp() public {
        usdc = new MockUSDC();
        factory = new PoolFactory(admin, verifier, address(usdc));
    }

    // -----------------------------------------------------------------------
    //  Constructor
    // -----------------------------------------------------------------------

    function test_constructor_setsImmutables() public view {
        assertEq(factory.admin(), admin);
        assertEq(factory.verifier(), verifier);
        assertEq(address(factory.usdc()), address(usdc));
        assertEq(factory.poolCount(), 0);
    }

    function test_constructor_revertsOnZeroAdmin() public {
        vm.expectRevert(PoolFactory.ZeroAddress.selector);
        new PoolFactory(address(0), verifier, address(usdc));
    }

    function test_constructor_revertsOnZeroVerifier() public {
        vm.expectRevert(PoolFactory.ZeroAddress.selector);
        new PoolFactory(admin, address(0), address(usdc));
    }

    function test_constructor_revertsOnZeroUSDC() public {
        vm.expectRevert(PoolFactory.ZeroAddress.selector);
        new PoolFactory(admin, verifier, address(0));
    }

    function test_constructor_revertsOnAdminEqualsVerifier() public {
        vm.expectRevert(PoolFactory.AdminVerifierCollision.selector);
        new PoolFactory(admin, admin, address(usdc));
    }

    // -----------------------------------------------------------------------
    //  NGO Registry — addVerifiedNGO
    // -----------------------------------------------------------------------

    function test_addVerifiedNGO_success() public {
        vm.prank(admin);
        factory.addVerifiedNGO(ngo1);

        assertTrue(factory.isVerified(ngo1));
        assertTrue(factory.verifiedNGOs(ngo1));
    }

    function test_addVerifiedNGO_emitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit PoolFactory.NGOApproved(ngo1);
        factory.addVerifiedNGO(ngo1);
    }

    function test_addVerifiedNGO_revertsForNonAdmin() public {
        vm.prank(stranger);
        vm.expectRevert(PoolFactory.OnlyAdmin.selector);
        factory.addVerifiedNGO(ngo1);
    }

    function test_addVerifiedNGO_revertsForVerifier() public {
        vm.prank(verifier);
        vm.expectRevert(PoolFactory.OnlyAdmin.selector);
        factory.addVerifiedNGO(ngo1);
    }

    function test_addVerifiedNGO_revertsOnZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(PoolFactory.ZeroAddress.selector);
        factory.addVerifiedNGO(address(0));
    }

    function test_addVerifiedNGO_revertsOnDuplicate() public {
        vm.startPrank(admin);
        factory.addVerifiedNGO(ngo1);

        vm.expectRevert(PoolFactory.NGOAlreadyVerified.selector);
        factory.addVerifiedNGO(ngo1);
        vm.stopPrank();
    }

    function test_addVerifiedNGO_multipleNGOs() public {
        vm.startPrank(admin);
        factory.addVerifiedNGO(ngo1);
        factory.addVerifiedNGO(ngo2);
        vm.stopPrank();

        assertTrue(factory.isVerified(ngo1));
        assertTrue(factory.isVerified(ngo2));
    }

    // -----------------------------------------------------------------------
    //  NGO Registry — revokeNGO
    // -----------------------------------------------------------------------

    function test_revokeNGO_success() public {
        vm.startPrank(admin);
        factory.addVerifiedNGO(ngo1);
        factory.revokeNGO(ngo1);
        vm.stopPrank();

        assertFalse(factory.isVerified(ngo1));
    }

    function test_revokeNGO_emitsEvent() public {
        vm.startPrank(admin);
        factory.addVerifiedNGO(ngo1);

        vm.expectEmit(true, false, false, false);
        emit PoolFactory.NGORevoked(ngo1);
        factory.revokeNGO(ngo1);
        vm.stopPrank();
    }

    function test_revokeNGO_revertsForNonAdmin() public {
        vm.prank(admin);
        factory.addVerifiedNGO(ngo1);

        vm.prank(stranger);
        vm.expectRevert(PoolFactory.OnlyAdmin.selector);
        factory.revokeNGO(ngo1);
    }

    function test_revokeNGO_revertsIfNotVerified() public {
        vm.prank(admin);
        vm.expectRevert(PoolFactory.NGONotVerified.selector);
        factory.revokeNGO(ngo1);
    }

    function test_revokeNGO_revertsOnDoubleRevoke() public {
        vm.startPrank(admin);
        factory.addVerifiedNGO(ngo1);
        factory.revokeNGO(ngo1);

        vm.expectRevert(PoolFactory.NGONotVerified.selector);
        factory.revokeNGO(ngo1);
        vm.stopPrank();
    }

    function test_revokeNGO_canReAddAfterRevoke() public {
        vm.startPrank(admin);
        factory.addVerifiedNGO(ngo1);
        factory.revokeNGO(ngo1);
        assertFalse(factory.isVerified(ngo1));

        // Re-add should work
        factory.addVerifiedNGO(ngo1);
        assertTrue(factory.isVerified(ngo1));
        vm.stopPrank();
    }

    // -----------------------------------------------------------------------
    //  NGO Registry — isVerified
    // -----------------------------------------------------------------------

    function test_isVerified_returnsFalseForUnknown() public view {
        assertFalse(factory.isVerified(stranger));
    }

    function test_isVerified_returnsFalseForZeroAddress() public view {
        assertFalse(factory.isVerified(address(0)));
    }

    // -----------------------------------------------------------------------
    //  Pool Deployment — deployPool
    // -----------------------------------------------------------------------

    function test_deployPool_success() public {
        vm.prank(admin);
        address poolAddr = factory.deployPool(MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);

        assertTrue(poolAddr != address(0));
        assertTrue(factory.isPool(poolAddr));
        assertEq(factory.poolCount(), 1);

        // Verify pool immutables
        CrisisPool pool = CrisisPool(poolAddr);
        assertEq(pool.maxPerClaim(), MAX_PER_CLAIM);
        assertEq(pool.maxPerNGOPerDay(), MAX_PER_NGO_DAY);
        assertEq(pool.maxPerNGOPool(), MAX_PER_NGO_POOL);
        assertEq(address(pool.usdc()), address(usdc));
        assertEq(pool.factory(), address(factory));
        assertEq(pool.admin(), admin);
        assertEq(pool.verifier(), verifier);
    }

    function test_deployPool_emitsEvent() public {
        vm.prank(admin);
        // We can't predict the exact pool address, so just check event shape
        vm.expectEmit(false, true, false, true);
        emit PoolFactory.PoolDeployed(address(0), 0, MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
        factory.deployPool(MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
    }

    function test_deployPool_incrementsPoolCount() public {
        vm.startPrank(admin);
        factory.deployPool(MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
        assertEq(factory.poolCount(), 1);

        factory.deployPool(MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
        assertEq(factory.poolCount(), 2);

        factory.deployPool(MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
        assertEq(factory.poolCount(), 3);
        vm.stopPrank();
    }

    function test_deployPool_poolsAreIsolated() public {
        vm.startPrank(admin);
        address pool1 = factory.deployPool(MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
        address pool2 = factory.deployPool(100e6, 500e6, 5_000e6);
        vm.stopPrank();

        assertTrue(pool1 != pool2);
        assertTrue(factory.isPool(pool1));
        assertTrue(factory.isPool(pool2));

        // Different caps
        assertEq(CrisisPool(pool1).maxPerClaim(), MAX_PER_CLAIM);
        assertEq(CrisisPool(pool2).maxPerClaim(), 100e6);
    }

    function test_deployPool_revertsForNonAdmin() public {
        vm.prank(stranger);
        vm.expectRevert(PoolFactory.OnlyAdmin.selector);
        factory.deployPool(MAX_PER_CLAIM, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
    }

    function test_deployPool_revertsOnZeroMaxPerClaim() public {
        vm.prank(admin);
        vm.expectRevert(PoolFactory.InvalidCapConfig.selector);
        factory.deployPool(0, MAX_PER_NGO_DAY, MAX_PER_NGO_POOL);
    }

    function test_deployPool_revertsWhenDailyLessThanClaim() public {
        vm.prank(admin);
        vm.expectRevert(PoolFactory.InvalidCapConfig.selector);
        // maxPerNGOPerDay (500) < maxPerClaim (1000)
        factory.deployPool(1_000e6, 500e6, MAX_PER_NGO_POOL);
    }

    function test_deployPool_revertsWhenPoolLessThanDaily() public {
        vm.prank(admin);
        vm.expectRevert(PoolFactory.InvalidCapConfig.selector);
        // maxPerNGOPool (1000) < maxPerNGOPerDay (5000)
        factory.deployPool(MAX_PER_CLAIM, 5_000e6, 1_000e6);
    }

    function test_deployPool_allowsEqualCaps() public {
        // Edge case: all caps equal should be valid
        vm.prank(admin);
        address poolAddr = factory.deployPool(1_000e6, 1_000e6, 1_000e6);
        assertTrue(factory.isPool(poolAddr));
    }
}
