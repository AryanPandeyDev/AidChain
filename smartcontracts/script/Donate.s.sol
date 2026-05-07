// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CrisisPool} from "../src/CrisisPool.sol";

/**
 * @title Donate
 * @notice Donor donates USDC to a CrisisPool.
 *         Prerequisite: donor must have approved the pool via USDC.approve() first.
 *
 * Environment variables:
 *   POOL   — CrisisPool contract address
 *   AMOUNT — Amount of USDC to donate (6 decimals)
 *
 * Usage (must broadcast with DONOR private key):
 *   forge script script/Donate.s.sol --rpc-url <RPC_URL> --broadcast --private-key <DONOR_PK>
 */
contract Donate is Script {
    function run() external {
        address poolAddr = vm.envAddress("POOL");
        uint256 amount = vm.envUint("AMOUNT");

        CrisisPool pool = CrisisPool(poolAddr);

        console.log("Donating to CrisisPool...");
        console.log("  Pool:  ", poolAddr);
        console.log("  Amount:", amount);

        vm.startBroadcast();
        pool.donate(amount);
        vm.stopBroadcast();

        console.log("Donation successful!");
        console.log("  Total Donated:", pool.totalDonated());
        console.log("  Pool Balance: ", pool.getPoolBalance());
    }
}
