// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPoolFactory
 * @notice Interface for the PoolFactory contract, used by CrisisPool
 *         to verify NGO status at release-time.
 */
interface IPoolFactory {
    /// @notice Returns true if the given address is admin-verified as a legitimate NGO.
    function isVerified(address ngo) external view returns (bool);
}
