package blockchain

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
)

// PoolFactoryABIJSON contains the ABI for PoolFactory contract functions used by the backend.
const PoolFactoryABIJSON = `[
  {"type":"function","name":"addVerifiedNGO","inputs":[{"name":"ngo","type":"address"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"deployPool","inputs":[{"name":"maxPerClaim","type":"uint256"},{"name":"maxPerNGOPerDay","type":"uint256"},{"name":"maxPerNGOPool","type":"uint256"}],"outputs":[{"name":"poolAddress","type":"address"}],"stateMutability":"nonpayable"},
  {"type":"function","name":"isVerified","inputs":[{"name":"ngo","type":"address"}],"outputs":[{"name":"","type":"bool"}],"stateMutability":"view"},
  {"type":"event","name":"NGOApproved","inputs":[{"name":"ngo","type":"address","indexed":true}]},
  {"type":"event","name":"NGORevoked","inputs":[{"name":"ngo","type":"address","indexed":true}]},
  {"type":"event","name":"PoolDeployed","inputs":[{"name":"poolAddress","type":"address","indexed":true},{"name":"poolIndex","type":"uint256","indexed":true},{"name":"maxPerClaim","type":"uint256","indexed":false},{"name":"maxPerNGOPerDay","type":"uint256","indexed":false},{"name":"maxPerNGOPool","type":"uint256","indexed":false}]}
]`

// AddVerifiedNGO calls PoolFactory.addVerifiedNGO(ngoWallet) signed by admin.
func (c *Client) AddVerifiedNGO(ctx context.Context, ngoWallet common.Address) (string, error) {
	auth, err := c.AdminAuth(ctx)
	if err != nil {
		return "", fmt.Errorf("admin auth: %w", err)
	}
	contract := bind.NewBoundContract(c.FactoryAddr, c.FactoryABI, c.Eth, c.Eth, c.Eth)
	tx, err := contract.Transact(auth, "addVerifiedNGO", ngoWallet)
	if err != nil {
		return "", fmt.Errorf("addVerifiedNGO tx: %w", err)
	}
	receipt, err := bind.WaitMined(ctx, c.Eth, tx)
	if err != nil {
		return "", fmt.Errorf("addVerifiedNGO wait: %w", err)
	}
	if receipt.Status != 1 {
		return "", fmt.Errorf("addVerifiedNGO reverted (tx %s)", tx.Hash().Hex())
	}
	return tx.Hash().Hex(), nil
}

// DeployPool calls PoolFactory.deployPool(caps) signed by admin and extracts the deployed pool address from the PoolDeployed event.
func (c *Client) DeployPool(ctx context.Context, maxPerClaim, maxPerNGOPerDay, maxPerNGOPool *big.Int) (common.Address, string, error) {
	auth, err := c.AdminAuth(ctx)
	if err != nil {
		return common.Address{}, "", fmt.Errorf("admin auth: %w", err)
	}
	contract := bind.NewBoundContract(c.FactoryAddr, c.FactoryABI, c.Eth, c.Eth, c.Eth)
	tx, err := contract.Transact(auth, "deployPool", maxPerClaim, maxPerNGOPerDay, maxPerNGOPool)
	if err != nil {
		return common.Address{}, "", fmt.Errorf("deployPool tx: %w", err)
	}
	receipt, err := bind.WaitMined(ctx, c.Eth, tx)
	if err != nil {
		return common.Address{}, "", fmt.Errorf("deployPool wait: %w", err)
	}
	if receipt.Status != 1 {
		return common.Address{}, "", fmt.Errorf("deployPool reverted (tx %s)", tx.Hash().Hex())
	}

	// Extract pool address from PoolDeployed event log.
	poolDeployedID := c.FactoryABI.Events["PoolDeployed"].ID
	for _, vLog := range receipt.Logs {
		if len(vLog.Topics) > 0 && vLog.Topics[0] == poolDeployedID {
			// poolAddress is the first indexed topic (Topics[1])
			poolAddr := common.HexToAddress(vLog.Topics[1].Hex())
			return poolAddr, tx.Hash().Hex(), nil
		}
	}
	return common.Address{}, tx.Hash().Hex(), fmt.Errorf("PoolDeployed event not found in receipt")
}
