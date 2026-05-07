// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PoolFactory} from "../src/PoolFactory.sol";

/**
 * @title RevokeNGO
 * @notice Admin removes an NGO from the global whitelist.
 *         Takes effect immediately — blocks all future releaseFunds() in ALL pools.
 *
 * Environment variables:
 *   FACTORY — PoolFactory contract address
 *   NGO     — NGO wallet address to revoke
 *
 * Usage (must broadcast with ADMIN private key):
 *   forge script script/RevokeNGO.s.sol --rpc-url <RPC_URL> --broadcast --private-key <ADMIN_PK>
 */
contract RevokeNGO is Script {
    function run() external {
        address factoryAddr = vm.envAddress("FACTORY");
        address ngo = vm.envAddress("NGO");

        PoolFactory factory = PoolFactory(factoryAddr);

        console.log("Revoking NGO:", ngo);

        vm.startBroadcast();
        factory.revokeNGO(ngo);
        vm.stopBroadcast();

        console.log("NGO revoked successfully!");
    }
}
