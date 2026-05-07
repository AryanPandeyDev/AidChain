// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CrisisPool} from "../src/CrisisPool.sol";

/**
 * @title ReleaseFunds
 * @notice Verifier releases USDC to an assigned NGO. Funds transfer immediately.
 *
 * Environment variables:
 *   POOL     — CrisisPool contract address
 *   NGO      — Recipient NGO wallet address
 *   AMOUNT   — Amount of USDC to release (6 decimals)
 *   PROOF_ID — Unique proof identifier (bytes32 hex string, e.g. 0xabc...123)
 *
 * Usage (must broadcast with VERIFIER private key):
 *   forge script script/ReleaseFunds.s.sol --rpc-url <RPC_URL> --broadcast --private-key <VERIFIER_PK>
 */
contract ReleaseFunds is Script {
    function run() external {
        address poolAddr = vm.envAddress("POOL");
        address ngo = vm.envAddress("NGO");
        uint256 amount = vm.envUint("AMOUNT");
        bytes32 proofId = vm.envBytes32("PROOF_ID");

        CrisisPool pool = CrisisPool(poolAddr);

        console.log("Releasing funds...");
        console.log("  Pool:    ", poolAddr);
        console.log("  NGO:     ", ngo);
        console.log("  Amount:  ", amount);
        console.logBytes32(proofId);

        vm.startBroadcast();
        pool.releaseFunds(ngo, amount, proofId);
        vm.stopBroadcast();

        console.log("Funds released successfully!");
        console.log("  Total Released:", pool.totalReleased());
        console.log("  Pool Balance:  ", pool.getPoolBalance());
    }
}
