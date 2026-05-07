// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CrisisPool} from "../src/CrisisPool.sol";

/**
 * @title ResumeDonations
 * @notice Admin resumes donations on a CrisisPool.
 *
 * Environment variables:
 *   POOL — CrisisPool contract address
 *
 * Usage (must broadcast with ADMIN private key):
 *   forge script script/ResumeDonations.s.sol --rpc-url <RPC_URL> --broadcast --private-key <ADMIN_PK>
 */
contract ResumeDonations is Script {
    function run() external {
        address poolAddr = vm.envAddress("POOL");
        CrisisPool pool = CrisisPool(poolAddr);

        console.log("Resuming donations on pool:", poolAddr);

        vm.startBroadcast();
        pool.resumeDonations();
        vm.stopBroadcast();

        console.log("Donations resumed!");
        console.log("  donationsPaused:", pool.donationsPaused());
    }
}
