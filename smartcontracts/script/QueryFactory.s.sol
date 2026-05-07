// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PoolFactory} from "../src/PoolFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title QueryFactory
 * @notice Read-only: queries the PoolFactory state (admin, verifier, poolCount, isPool).
 *
 * Environment variables:
 *   FACTORY — PoolFactory contract address
 *   POOL    — (optional) Pool address to check in isPool mapping. Set to address(0) to skip.
 *
 * Usage:
 *   forge script script/QueryFactory.s.sol --rpc-url <RPC_URL>
 */
contract QueryFactory is Script {
    function run() external view {
        address factoryAddr = vm.envAddress("FACTORY");

        PoolFactory factory = PoolFactory(factoryAddr);

        console.log("=== PoolFactory State ===");
        console.log("Factory:   ", factoryAddr);
        console.log("Admin:     ", factory.admin());
        console.log("Verifier:  ", factory.verifier());
        console.log("USDC:      ", address(factory.usdc()));
        console.log("Pool Count:", factory.poolCount());

        // Optionally check if an address is a registered pool
        address poolToCheck = vm.envOr("POOL", address(0));
        if (poolToCheck != address(0)) {
            console.log("---");
            console.log("Checking pool:", poolToCheck);
            console.log("Is Pool:", factory.isPool(poolToCheck));
        }
    }
}
