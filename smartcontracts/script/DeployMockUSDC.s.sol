// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/**
 * @title DeployMockUSDC
 * @notice Deploys the MockUSDC token contract.
 *
 * Usage:
 *   forge script script/DeployMockUSDC.s.sol --rpc-url <RPC_URL> --broadcast --private-key <DEPLOYER_PK>
 */
contract DeployMockUSDC is Script {
    function run() external {
        vm.startBroadcast();

        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        vm.stopBroadcast();
    }
}
