// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/**
 * @title MintMockUSDC
 * @notice Mints MockUSDC tokens to a recipient address (testnet only).
 *
 * Environment variables:
 *   USDC      — MockUSDC contract address
 *   RECIPIENT — Address to receive minted tokens
 *   AMOUNT    — Amount to mint (6 decimals, e.g. 1000000000 = 1000 USDC)
 *
 * Usage:
 *   forge script script/MintMockUSDC.s.sol --rpc-url <RPC_URL> --broadcast --private-key <ANY_PK>
 */
contract MintMockUSDC is Script {
    function run() external {
        address usdcAddr = vm.envAddress("USDC");
        address recipient = vm.envAddress("RECIPIENT");
        uint256 amount = vm.envUint("AMOUNT");

        MockUSDC usdc = MockUSDC(usdcAddr);

        console.log("Minting MockUSDC...");
        console.log("  To:    ", recipient);
        console.log("  Amount:", amount);

        vm.startBroadcast();
        usdc.mint(recipient, amount);
        vm.stopBroadcast();

        console.log("Minted successfully! New balance:", usdc.balanceOf(recipient));
    }
}
