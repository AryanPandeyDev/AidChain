// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {PoolFactory} from "../src/PoolFactory.sol";
import {CrisisPool} from "../src/CrisisPool.sol";

/**
 * @title SeedData
 * @notice Seeds Anvil with realistic test data so the frontend has content to display.
 *
 *   Creates:
 *     - MockUSDC token
 *     - PoolFactory
 *     - 3 verified NGOs
 *     - 3 crisis pools (different cap tiers)
 *     - Multiple donations from 3 donors
 *     - NGO assignments
 *     - Several fund releases with unique proofIds
 *
 *   After running, call the Anvil RPC `anvil_dumpState` to persist.
 *
 * Usage:
 *   forge script script/SeedData.s.sol \
 *     --rpc-url http://127.0.0.1:8545 \
 *     --broadcast \
 *     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 */
contract SeedData is Script {
    // ---- Anvil default accounts ----
    // Account 0 = Admin
    address constant ADMIN    = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    uint256 constant ADMIN_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    // Account 1 = Verifier (backend hot wallet)
    address constant VERIFIER    = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    uint256 constant VERIFIER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;

    // Accounts 2-4 = Donors
    address constant DONOR_1    = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    uint256 constant DONOR_1_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    address constant DONOR_2    = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
    uint256 constant DONOR_2_PK = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;

    address constant DONOR_3    = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
    uint256 constant DONOR_3_PK = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;

    // Accounts 5-7 = NGOs
    address constant NGO_1 = 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc;  // account 5
    address constant NGO_2 = 0x976EA74026E726554dB657fA54763abd0C3a0aa9;  // account 6
    address constant NGO_3 = 0x14Dc79964dA2c08da15Fd353D30d9cBBd4d740a3;  // account 7

    // State captured during deploy
    MockUSDC public usdc;
    PoolFactory public factory;
    address public pool1Addr;
    address public pool2Addr;
    address public pool3Addr;

    function run() external {
        _step1_deployCore();
        _step2_verifyNGOs();
        _step3_deployPools();
        _step4_mintUSDC();
        _step5_donatePool1();
        _step6_donatePool2();
        _step7_donatePool3();
        _step8_assignNGOs();
        _step9_releaseFunds();
        _step10_pausePool3();
        _printSummary();
        _writeJson();
    }

    // ---- Step 1: Deploy MockUSDC + PoolFactory ----
    function _step1_deployCore() internal {
        vm.startBroadcast(ADMIN_PK);

        usdc = new MockUSDC();
        console.log("[1] MockUSDC:", address(usdc));

        factory = new PoolFactory(ADMIN, VERIFIER, address(usdc));
        console.log("[1] PoolFactory:", address(factory));

        vm.stopBroadcast();
    }

    // ---- Step 2: Verify 3 NGOs ----
    function _step2_verifyNGOs() internal {
        vm.startBroadcast(ADMIN_PK);

        factory.addVerifiedNGO(NGO_1);
        console.log("[2] NGO_1 verified:", NGO_1);

        factory.addVerifiedNGO(NGO_2);
        console.log("[2] NGO_2 verified:", NGO_2);

        factory.addVerifiedNGO(NGO_3);
        console.log("[2] NGO_3 verified:", NGO_3);

        vm.stopBroadcast();
    }

    // ---- Step 3: Deploy 3 crisis pools with different cap tiers ----
    function _step3_deployPools() internal {
        vm.startBroadcast(ADMIN_PK);

        // Pool 1: "Turkey Earthquake Relief" — large caps
        pool1Addr = factory.deployPool(
            500_000_000,    // maxPerClaim    = 500 USDC
            2_000_000_000,  // maxPerNGOPerDay = 2,000 USDC
            50_000_000_000  // maxPerNGOPool   = 50,000 USDC
        );
        console.log("[3] Pool 1 (Earthquake Relief):", pool1Addr);

        // Pool 2: "East Africa Drought Response" — medium caps
        pool2Addr = factory.deployPool(
            200_000_000,    // maxPerClaim    = 200 USDC
            1_000_000_000,  // maxPerNGOPerDay = 1,000 USDC
            10_000_000_000  // maxPerNGOPool   = 10,000 USDC
        );
        console.log("[3] Pool 2 (Drought Response):", pool2Addr);

        // Pool 3: "Bangladesh Flood Aid" — small caps
        pool3Addr = factory.deployPool(
            100_000_000,    // maxPerClaim    = 100 USDC
            500_000_000,    // maxPerNGOPerDay = 500 USDC
            5_000_000_000   // maxPerNGOPool   = 5,000 USDC
        );
        console.log("[3] Pool 3 (Flood Aid):", pool3Addr);

        vm.stopBroadcast();
    }

    // ---- Step 4: Mint USDC to all donors ----
    function _step4_mintUSDC() internal {
        vm.startBroadcast(ADMIN_PK);

        usdc.mint(DONOR_1, 100_000_000_000); // 100,000 USDC
        usdc.mint(DONOR_2, 50_000_000_000);  // 50,000 USDC
        usdc.mint(DONOR_3, 25_000_000_000);  // 25,000 USDC

        console.log("[4] Minted USDC to donors");

        vm.stopBroadcast();
    }

    // ---- Step 5: Donations to Pool 1 (Earthquake Relief) ----
    function _step5_donatePool1() internal {
        // Donor 1 donates 15,000 USDC
        vm.startBroadcast(DONOR_1_PK);
        usdc.approve(pool1Addr, 15_000_000_000);
        CrisisPool(pool1Addr).donate(15_000_000_000);
        console.log("[5] Donor1 donated 15,000 USDC to Pool 1");
        vm.stopBroadcast();

        // Donor 2 donates 8,000 USDC
        vm.startBroadcast(DONOR_2_PK);
        usdc.approve(pool1Addr, 8_000_000_000);
        CrisisPool(pool1Addr).donate(8_000_000_000);
        console.log("[5] Donor2 donated 8,000 USDC to Pool 1");
        vm.stopBroadcast();

        // Donor 3 donates 2,500 USDC
        vm.startBroadcast(DONOR_3_PK);
        usdc.approve(pool1Addr, 2_500_000_000);
        CrisisPool(pool1Addr).donate(2_500_000_000);
        console.log("[5] Donor3 donated 2,500 USDC to Pool 1");
        vm.stopBroadcast();
    }

    // ---- Step 6: Donations to Pool 2 (Drought Response) ----
    function _step6_donatePool2() internal {
        // Donor 1 donates 5,000 USDC
        vm.startBroadcast(DONOR_1_PK);
        usdc.approve(pool2Addr, 5_000_000_000);
        CrisisPool(pool2Addr).donate(5_000_000_000);
        console.log("[6] Donor1 donated 5,000 USDC to Pool 2");
        vm.stopBroadcast();

        // Donor 2 donates 3,000 USDC
        vm.startBroadcast(DONOR_2_PK);
        usdc.approve(pool2Addr, 3_000_000_000);
        CrisisPool(pool2Addr).donate(3_000_000_000);
        console.log("[6] Donor2 donated 3,000 USDC to Pool 2");
        vm.stopBroadcast();
    }

    // ---- Step 7: Donations to Pool 3 (Flood Aid) ----
    function _step7_donatePool3() internal {
        // Donor 3 donates 1,500 USDC
        vm.startBroadcast(DONOR_3_PK);
        usdc.approve(pool3Addr, 1_500_000_000);
        CrisisPool(pool3Addr).donate(1_500_000_000);
        console.log("[7] Donor3 donated 1,500 USDC to Pool 3");
        vm.stopBroadcast();

        // Donor 1 donates 4,000 USDC
        vm.startBroadcast(DONOR_1_PK);
        usdc.approve(pool3Addr, 4_000_000_000);
        CrisisPool(pool3Addr).donate(4_000_000_000);
        console.log("[7] Donor1 donated 4,000 USDC to Pool 3");
        vm.stopBroadcast();
    }

    // ---- Step 8: Assign NGOs to pools ----
    function _step8_assignNGOs() internal {
        vm.startBroadcast(ADMIN_PK);

        // Pool 1: assign NGO_1 and NGO_2
        CrisisPool(pool1Addr).assignNGO(NGO_1);
        CrisisPool(pool1Addr).assignNGO(NGO_2);
        console.log("[8] Pool 1: assigned NGO_1 + NGO_2");

        // Pool 2: assign NGO_2 and NGO_3
        CrisisPool(pool2Addr).assignNGO(NGO_2);
        CrisisPool(pool2Addr).assignNGO(NGO_3);
        console.log("[8] Pool 2: assigned NGO_2 + NGO_3");

        // Pool 3: assign NGO_1 and NGO_3
        CrisisPool(pool3Addr).assignNGO(NGO_1);
        CrisisPool(pool3Addr).assignNGO(NGO_3);
        console.log("[8] Pool 3: assigned NGO_1 + NGO_3");

        vm.stopBroadcast();
    }

    // ---- Step 9: Release funds (verifier) — multiple releases ----
    function _step9_releaseFunds() internal {
        vm.startBroadcast(VERIFIER_PK);

        // Pool 1 releases
        CrisisPool(pool1Addr).releaseFunds(NGO_1, 500_000_000, keccak256("proof-eq-001"));
        CrisisPool(pool1Addr).releaseFunds(NGO_1, 300_000_000, keccak256("proof-eq-002"));
        CrisisPool(pool1Addr).releaseFunds(NGO_2, 450_000_000, keccak256("proof-eq-003"));
        CrisisPool(pool1Addr).releaseFunds(NGO_2, 200_000_000, keccak256("proof-eq-004"));
        CrisisPool(pool1Addr).releaseFunds(NGO_1, 150_000_000, keccak256("proof-eq-005"));
        console.log("[9] Pool 1: 5 releases (1,600 USDC total)");

        // Pool 2 releases
        CrisisPool(pool2Addr).releaseFunds(NGO_2, 200_000_000, keccak256("proof-dr-001"));
        CrisisPool(pool2Addr).releaseFunds(NGO_3, 180_000_000, keccak256("proof-dr-002"));
        CrisisPool(pool2Addr).releaseFunds(NGO_2, 150_000_000, keccak256("proof-dr-003"));
        console.log("[9] Pool 2: 3 releases (530 USDC total)");

        // Pool 3 releases
        CrisisPool(pool3Addr).releaseFunds(NGO_1, 100_000_000, keccak256("proof-fl-001"));
        CrisisPool(pool3Addr).releaseFunds(NGO_3, 75_000_000,  keccak256("proof-fl-002"));
        console.log("[9] Pool 3: 2 releases (175 USDC total)");

        vm.stopBroadcast();
    }

    // ---- Step 10: Pause donations on Pool 3 (simulate completed crisis) ----
    function _step10_pausePool3() internal {
        vm.startBroadcast(ADMIN_PK);
        CrisisPool(pool3Addr).pauseDonations();
        console.log("[10] Pool 3 donations paused");
        vm.stopBroadcast();
    }

    // ---- Print Summary ----
    function _printSummary() internal view {
        console.log("");
        console.log("========================================");
        console.log("         SEED DATA SUMMARY");
        console.log("========================================");
        console.log("");
        _printPoolState("Pool 1 (Earthquake)", pool1Addr);
        _printPoolState("Pool 2 (Drought)", pool2Addr);
        _printPoolState("Pool 3 (Flood)", pool3Addr);
    }

    function _printPoolState(string memory name, address addr) internal view {
        CrisisPool p = CrisisPool(addr);
        console.log("---", name, "---");
        console.log("  Address:       ", addr);
        console.log("  Balance:       ", p.getPoolBalance());
        console.log("  Total Donated: ", p.totalDonated());
        console.log("  Total Released:", p.totalReleased());
        console.log("  Paused:        ", p.donationsPaused());
        console.log("");
    }

    // ---- Write addresses to JSON ----
    function _writeJson() internal {
        string memory obj = "seed";

        vm.serializeAddress(obj, "mockUSDC",    address(usdc));
        vm.serializeAddress(obj, "poolFactory",  address(factory));
        vm.serializeAddress(obj, "pool1",        pool1Addr);
        vm.serializeAddress(obj, "pool2",        pool2Addr);
        vm.serializeAddress(obj, "pool3",        pool3Addr);
        vm.serializeAddress(obj, "admin",        ADMIN);
        vm.serializeAddress(obj, "verifier",     VERIFIER);
        vm.serializeAddress(obj, "donor1",       DONOR_1);
        vm.serializeAddress(obj, "donor2",       DONOR_2);
        vm.serializeAddress(obj, "donor3",       DONOR_3);
        vm.serializeAddress(obj, "ngo1",         NGO_1);
        vm.serializeAddress(obj, "ngo2",         NGO_2);

        // Last serialize call returns the full JSON string
        string memory json = vm.serializeAddress(obj, "ngo3", NGO_3);

        vm.writeJson(json, "./seed-data.json");
        console.log("Addresses written to seed-data.json");
    }
}
