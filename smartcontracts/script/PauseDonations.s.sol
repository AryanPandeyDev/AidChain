// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CrisisPool} from "../src/CrisisPool.sol";

/**
 * @title PauseDonations
 * @notice Admin pauses new donations on a CrisisPool.
 *         Does NOT affect existing funds or future releases.
 *
 * Environment variables:
 *   POOL — CrisisPool contract address
 *
 * Usage (must broadcast with ADMIN private key):
 *   forge script script/PauseDonations.s.sol --rpc-url <RPC_URL> --broadcast --private-key <ADMIN_PK>
 */
contract PauseDonations is Script {
    function run() external {
        address poolAddr = vm.envAddress("POOL");

        CrisisPool pool = CrisisPool(poolAddr);

        console.log("Pausing donations on pool:", poolAddr);

        vm.startBroadcast();
        pool.pauseDonations();
        vm.stopBroadcast();

        console.log("Donations paused!");
        console.log("  donationsPaused:", pool.donationsPaused());
    }
}
