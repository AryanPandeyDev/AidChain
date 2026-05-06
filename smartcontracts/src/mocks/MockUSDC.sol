// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Minimal ERC20 mock with public mint for testnet/testing use.
 *         Mimics USDC's 6-decimal precision.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens to any address. Testnet only — no access control.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
