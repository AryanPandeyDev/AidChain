// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CrisisPool} from "../src/CrisisPool.sol";

/**
 * @title CheckProofUsed
 * @notice Read-only: checks if a proofId has already been used in a CrisisPool.
 *
 * Environment variables:
 *   POOL     — CrisisPool contract address
 *   PROOF_ID — Proof ID to check (bytes32 hex string)
 *
 * Usage:
 *   forge script script/CheckProofUsed.s.sol --rpc-url <RPC_URL>
 */
contract CheckProofUsed is Script {
    function run() external view {
        address poolAddr = vm.envAddress("POOL");
        bytes32 proofId = vm.envBytes32("PROOF_ID");

        CrisisPool pool = CrisisPool(poolAddr);

        bool used = pool.usedProofIds(proofId);
        console.log("Pool:", poolAddr);
        console.logBytes32(proofId);
        console.log("Used:", used);
    }
}
