// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {PoolFactory} from "../src/PoolFactory.sol";
import {CrisisPool} from "../src/CrisisPool.sol";

/**
 * @title FullFlowDemo
 * @notice Deploys everything and runs the complete happy-path flow in one shot.
 *         Intended for local Anvil testing.
 *
 *         Flow: Deploy MockUSDC → Deploy PoolFactory → Add NGO → Deploy Pool
 *               → Mint USDC to donor → Approve → Donate → Assign NGO → Release Funds
 *
 * Usage:
 *   forge script script/FullFlowDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <PK>
 *
 * For Anvil, use the first default account PK:
 *   0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 */
contract FullFlowDemo is Script {
    function run() external {
        _deployAndSetup();
    }

    function _deployAndSetup() internal {
        // Anvil default accounts
        address admin    = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // account 0
        address verifier = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // account 1
        address donor    = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // account 2
        address ngo      = 0x90F79bf6EB2c4f870365E785982E1f101E93b906; // account 3

        vm.startBroadcast();

        // 1. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("[1] MockUSDC deployed:", address(usdc));

        // 2. Deploy PoolFactory
        PoolFactory factory = new PoolFactory(admin, verifier, address(usdc));
        console.log("[2] PoolFactory deployed:", address(factory));

        // 3. Add verified NGO
        factory.addVerifiedNGO(ngo);
        console.log("[3] NGO verified:", ngo);

        // 4. Deploy pool (100 USDC per claim, 500/day, 5000 total)
        address poolAddr = factory.deployPool(100_000_000, 500_000_000, 5_000_000_000);
        console.log("[4] CrisisPool deployed:", poolAddr);

        // 5. Mint 10,000 USDC to donor
        usdc.mint(donor, 10_000_000_000);
        console.log("[5] Minted 10000 USDC to donor");

        vm.stopBroadcast();

        // 6. Donor approves + donates
        _donorFlow(address(usdc), poolAddr);

        // 7. Admin assigns NGO
        _adminAssign(poolAddr, ngo);

        // 8. Verifier releases
        _verifierRelease(poolAddr, ngo);

        // Final state
        _printFinalState(poolAddr, ngo);
    }

    function _donorFlow(address usdcAddr, address poolAddr) internal {
        uint256 donorPk = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
        vm.startBroadcast(donorPk);
        MockUSDC(usdcAddr).approve(poolAddr, 1_000_000_000);
        CrisisPool(poolAddr).donate(1_000_000_000);
        console.log("[6] Donated 1000 USDC to pool");
        vm.stopBroadcast();
    }

    function _adminAssign(address poolAddr, address ngo) internal {
        vm.startBroadcast();
        CrisisPool(poolAddr).assignNGO(ngo);
        console.log("[7] NGO assigned to pool");
        vm.stopBroadcast();
    }

    function _verifierRelease(address poolAddr, address ngo) internal {
        uint256 verifierPk = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
        vm.startBroadcast(verifierPk);
        bytes32 proofId = keccak256("test-proof-001");
        CrisisPool(poolAddr).releaseFunds(ngo, 50_000_000, proofId);
        console.log("[8] Released 50 USDC to NGO");
        vm.stopBroadcast();
    }

    function _printFinalState(address poolAddr, address ngo) internal view {
        CrisisPool pool = CrisisPool(poolAddr);
        console.log("");
        console.log("=== Final State ===");
        console.log("Pool Balance:  ", pool.getPoolBalance());
        console.log("Total Donated: ", pool.totalDonated());
        console.log("Total Released:", pool.totalReleased());
        console.log("NGO Claimed:   ", pool.totalClaimedByNGO(ngo));
    }
}
