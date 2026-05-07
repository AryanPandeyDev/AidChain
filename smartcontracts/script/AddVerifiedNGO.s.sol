// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PoolFactory} from "../src/PoolFactory.sol";

/**
 * @title AddVerifiedNGO
 * @notice Admin adds an NGO wallet to the global whitelist.
 *
 * Environment variables:
 *   FACTORY — PoolFactory contract address
 *   NGO     — NGO wallet address to whitelist
 *
 * Usage (must broadcast with ADMIN private key):
 *   forge script script/AddVerifiedNGO.s.sol --rpc-url <RPC_URL> --broadcast --private-key <ADMIN_PK>
 */
contract AddVerifiedNGO is Script {
    function run() external {
        address factoryAddr = vm.envAddress("FACTORY");
        address ngo = vm.envAddress("NGO");

        PoolFactory factory = PoolFactory(factoryAddr);

        console.log("Adding verified NGO:", ngo);
        console.log("Factory:", factoryAddr);

        vm.startBroadcast();
        factory.addVerifiedNGO(ngo);
        vm.stopBroadcast();

        console.log("NGO added successfully!");
    }
}
