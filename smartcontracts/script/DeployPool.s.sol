// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PoolFactory} from "../src/PoolFactory.sol";

/**
 * @title DeployPool
 * @notice Admin deploys a new CrisisPool via the PoolFactory.
 *
 * Environment variables:
 *   FACTORY          — PoolFactory contract address
 *   MAX_PER_CLAIM    — Max USDC per single releaseFunds() call (6 decimals)
 *   MAX_PER_NGO_DAY  — Max USDC an NGO can receive per UTC day (6 decimals)
 *   MAX_PER_NGO_POOL — Max USDC an NGO can receive from this pool total (6 decimals)
 *
 * Usage (must broadcast with ADMIN private key):
 *   forge script script/DeployPool.s.sol --rpc-url <RPC_URL> --broadcast --private-key <ADMIN_PK>
 */
contract DeployPool is Script {
    function run() external {
        address factoryAddr = vm.envAddress("FACTORY");
        uint256 maxPerClaim = vm.envUint("MAX_PER_CLAIM");
        uint256 maxPerNGOPerDay = vm.envUint("MAX_PER_NGO_DAY");
        uint256 maxPerNGOPool = vm.envUint("MAX_PER_NGO_POOL");

        PoolFactory factory = PoolFactory(factoryAddr);

        console.log("Deploying CrisisPool...");
        console.log("  maxPerClaim:   ", maxPerClaim);
        console.log("  maxPerNGOPerDay:", maxPerNGOPerDay);
        console.log("  maxPerNGOPool: ", maxPerNGOPool);

        vm.startBroadcast();
        address pool = factory.deployPool(maxPerClaim, maxPerNGOPerDay, maxPerNGOPool);
        vm.stopBroadcast();

        console.log("CrisisPool deployed at:", pool);
    }
}
