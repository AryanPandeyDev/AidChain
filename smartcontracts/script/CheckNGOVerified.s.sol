// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PoolFactory} from "../src/PoolFactory.sol";

/**
 * @title CheckNGOVerified
 * @notice Read-only: checks if an NGO address is verified in the factory whitelist.
 *
 * Environment variables:
 *   FACTORY — PoolFactory contract address
 *   NGO     — NGO wallet address to check
 *
 * Usage:
 *   forge script script/CheckNGOVerified.s.sol --rpc-url <RPC_URL>
 */
contract CheckNGOVerified is Script {
    function run() external view {
        address factoryAddr = vm.envAddress("FACTORY");
        address ngo = vm.envAddress("NGO");

        PoolFactory factory = PoolFactory(factoryAddr);

        bool verified = factory.isVerified(ngo);
        console.log("NGO:", ngo);
        console.log("Verified:", verified);
    }
}
