// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CrisisPool} from "../src/CrisisPool.sol";

/**
 * @title AssignNGO
 * @notice Admin assigns a verified NGO to a specific CrisisPool.
 *         The NGO must already be whitelisted in the PoolFactory.
 *
 * Environment variables:
 *   POOL — CrisisPool contract address
 *   NGO  — NGO wallet address to assign
 *
 * Usage (must broadcast with ADMIN private key):
 *   forge script script/AssignNGO.s.sol --rpc-url <RPC_URL> --broadcast --private-key <ADMIN_PK>
 */
contract AssignNGO is Script {
    function run() external {
        address poolAddr = vm.envAddress("POOL");
        address ngo = vm.envAddress("NGO");

        CrisisPool pool = CrisisPool(poolAddr);

        console.log("Assigning NGO to pool...");
        console.log("  Pool:", poolAddr);
        console.log("  NGO: ", ngo);

        vm.startBroadcast();
        pool.assignNGO(ngo);
        vm.stopBroadcast();

        console.log("NGO assigned successfully!");
    }
}
