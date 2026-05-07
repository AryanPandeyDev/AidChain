// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CrisisPool} from "../src/CrisisPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title QueryPool
 * @notice Read-only: queries full state of a CrisisPool contract.
 *
 * Environment variables:
 *   POOL — CrisisPool contract address
 *   NGO  — (optional) NGO address for per-NGO queries. Set to address(0) to skip.
 *
 * Usage:
 *   forge script script/QueryPool.s.sol --rpc-url <RPC_URL>
 */
contract QueryPool is Script {
    function run() external view {
        address poolAddr = vm.envAddress("POOL");
        CrisisPool pool = CrisisPool(poolAddr);

        console.log("=== CrisisPool State ===");
        console.log("Pool:          ", poolAddr);
        console.log("Factory:       ", pool.factory());
        console.log("Admin:         ", pool.admin());
        console.log("Verifier:      ", pool.verifier());
        console.log("USDC:          ", address(pool.usdc()));
        console.log("--- Caps ---");
        console.log("maxPerClaim:   ", pool.maxPerClaim());
        console.log("maxPerNGOPerDay:", pool.maxPerNGOPerDay());
        console.log("maxPerNGOPool: ", pool.maxPerNGOPool());
        console.log("--- Balances ---");
        console.log("Pool Balance:  ", pool.getPoolBalance());
        console.log("Total Donated: ", pool.totalDonated());
        console.log("Total Released:", pool.totalReleased());
        console.log("Paused:        ", pool.donationsPaused());

        address ngo = vm.envOr("NGO", address(0));
        if (ngo != address(0)) {
            console.log("--- NGO Info ---");
            console.log("NGO:           ", ngo);
            console.log("Assigned:      ", pool.assignedNGOs(ngo));
            console.log("Total Claimed: ", pool.totalClaimedByNGO(ngo));
            console.log("Daily Claimed: ", pool.getDailyClaimedAmount(ngo));
        }
    }
}
