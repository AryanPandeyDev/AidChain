// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PoolFactory} from "../src/PoolFactory.sol";

/**
 * @title DeployPoolFactory
 * @notice Deploys the PoolFactory contract.
 *
 * Environment variables:
 *   ADMIN    — Admin wallet address (cold/hardware wallet)
 *   VERIFIER — Verifier wallet address (backend hot wallet)
 *   USDC     — USDC (or MockUSDC) token contract address
 *
 * Usage:
 *   forge script script/DeployPoolFactory.s.sol --rpc-url <RPC_URL> --broadcast --private-key <DEPLOYER_PK>
 */
contract DeployPoolFactory is Script {
    function run() external {
        address admin = vm.envAddress("ADMIN");
        address verifier = vm.envAddress("VERIFIER");
        address usdc = vm.envAddress("USDC");

        console.log("Deploying PoolFactory...");
        console.log("  Admin:   ", admin);
        console.log("  Verifier:", verifier);
        console.log("  USDC:    ", usdc);

        vm.startBroadcast();

        PoolFactory factory = new PoolFactory(admin, verifier, usdc);
        console.log("PoolFactory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}
