// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ApproveUSDC
 * @notice Donor approves a CrisisPool (spender) to transfer their USDC.
 *         This must be called before donate().
 *
 * Environment variables:
 *   USDC    — USDC (or MockUSDC) token contract address
 *   SPENDER — CrisisPool address to approve as spender
 *   AMOUNT  — Amount of USDC to approve (6 decimals)
 *
 * Usage (must broadcast with DONOR private key):
 *   forge script script/ApproveUSDC.s.sol --rpc-url <RPC_URL> --broadcast --private-key <DONOR_PK>
 */
contract ApproveUSDC is Script {
    function run() external {
        address usdcAddr = vm.envAddress("USDC");
        address spender = vm.envAddress("SPENDER");
        uint256 amount = vm.envUint("AMOUNT");

        IERC20 usdc = IERC20(usdcAddr);

        console.log("Approving USDC spend...");
        console.log("  USDC:    ", usdcAddr);
        console.log("  Spender: ", spender);
        console.log("  Amount:  ", amount);

        vm.startBroadcast();
        usdc.approve(spender, amount);
        vm.stopBroadcast();

        console.log("Approved successfully!");
    }
}
