package blockchain

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
)

// CrisisPoolABIJSON contains the ABI for CrisisPool contract functions used by the backend.
const CrisisPoolABIJSON = `[
  {"type":"function","name":"assignNGO","inputs":[{"name":"ngo","type":"address"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"releaseFunds","inputs":[{"name":"ngo","type":"address"},{"name":"amount","type":"uint256"},{"name":"proofId","type":"bytes32"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"pauseDonations","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"resumeDonations","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"getPoolBalance","inputs":[],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},
  {"type":"function","name":"donationsPaused","inputs":[],"outputs":[{"name":"","type":"bool"}],"stateMutability":"view"},
  {"type":"event","name":"DonationReceived","inputs":[{"name":"donor","type":"address","indexed":true},{"name":"amount","type":"uint256","indexed":false}]},
  {"type":"event","name":"NGOAssigned","inputs":[{"name":"ngo","type":"address","indexed":true}]},
  {"type":"event","name":"FundsReleased","inputs":[{"name":"ngo","type":"address","indexed":true},{"name":"amount","type":"uint256","indexed":false},{"name":"proofId","type":"bytes32","indexed":false}]},
  {"type":"event","name":"DonationsPausedEvent","inputs":[]},
  {"type":"event","name":"DonationsResumedEvent","inputs":[]}
]`

// AssignNGO calls CrisisPool.assignNGO(ngoWallet) signed by admin.
func (c *Client) AssignNGO(ctx context.Context, poolAddr, ngoWallet common.Address) (string, error) {
	auth, err := c.AdminAuth(ctx)
	if err != nil {
		return "", fmt.Errorf("admin auth: %w", err)
	}
	contract := bind.NewBoundContract(poolAddr, c.PoolABI, c.Eth, c.Eth, c.Eth)
	tx, err := contract.Transact(auth, "assignNGO", ngoWallet)
	if err != nil {
		return "", fmt.Errorf("assignNGO tx: %w", err)
	}
	receipt, err := bind.WaitMined(ctx, c.Eth, tx)
	if err != nil {
		return "", fmt.Errorf("assignNGO wait: %w", err)
	}
	if receipt.Status != 1 {
		return "", fmt.Errorf("assignNGO reverted (tx %s)", tx.Hash().Hex())
	}
	return tx.Hash().Hex(), nil
}

// ReleaseFunds calls CrisisPool.releaseFunds(ngo, amount, proofId) signed by verifier.
func (c *Client) ReleaseFunds(ctx context.Context, poolAddr, ngoWallet common.Address, amount *big.Int, proofId [32]byte) (string, error) {
	auth, err := c.VerifierAuth(ctx)
	if err != nil {
		return "", fmt.Errorf("verifier auth: %w", err)
	}
	contract := bind.NewBoundContract(poolAddr, c.PoolABI, c.Eth, c.Eth, c.Eth)
	tx, err := contract.Transact(auth, "releaseFunds", ngoWallet, amount, proofId)
	if err != nil {
		return "", fmt.Errorf("releaseFunds tx: %w", err)
	}
	receipt, err := bind.WaitMined(ctx, c.Eth, tx)
	if err != nil {
		return "", fmt.Errorf("releaseFunds wait: %w", err)
	}
	if receipt.Status != 1 {
		return "", fmt.Errorf("releaseFunds reverted (tx %s)", tx.Hash().Hex())
	}
	return tx.Hash().Hex(), nil
}

// PauseDonations calls CrisisPool.pauseDonations() signed by admin.
func (c *Client) PauseDonations(ctx context.Context, poolAddr common.Address) (string, error) {
	auth, err := c.AdminAuth(ctx)
	if err != nil {
		return "", fmt.Errorf("admin auth: %w", err)
	}
	contract := bind.NewBoundContract(poolAddr, c.PoolABI, c.Eth, c.Eth, c.Eth)
	tx, err := contract.Transact(auth, "pauseDonations")
	if err != nil {
		return "", fmt.Errorf("pauseDonations tx: %w", err)
	}
	receipt, err := bind.WaitMined(ctx, c.Eth, tx)
	if err != nil {
		return "", fmt.Errorf("pauseDonations wait: %w", err)
	}
	if receipt.Status != 1 {
		return "", fmt.Errorf("pauseDonations reverted (tx %s)", tx.Hash().Hex())
	}
	return tx.Hash().Hex(), nil
}

// ResumeDonations calls CrisisPool.resumeDonations() signed by admin.
func (c *Client) ResumeDonations(ctx context.Context, poolAddr common.Address) (string, error) {
	auth, err := c.AdminAuth(ctx)
	if err != nil {
		return "", fmt.Errorf("admin auth: %w", err)
	}
	contract := bind.NewBoundContract(poolAddr, c.PoolABI, c.Eth, c.Eth, c.Eth)
	tx, err := contract.Transact(auth, "resumeDonations")
	if err != nil {
		return "", fmt.Errorf("resumeDonations tx: %w", err)
	}
	receipt, err := bind.WaitMined(ctx, c.Eth, tx)
	if err != nil {
		return "", fmt.Errorf("resumeDonations wait: %w", err)
	}
	if receipt.Status != 1 {
		return "", fmt.Errorf("resumeDonations reverted (tx %s)", tx.Hash().Hex())
	}
	return tx.Hash().Hex(), nil
}

// GetPoolBalance calls CrisisPool.getPoolBalance() — returns the USDC balance in 6-decimal.
func (c *Client) GetPoolBalance(ctx context.Context, poolAddr common.Address) (*big.Int, error) {
	contract := bind.NewBoundContract(poolAddr, c.PoolABI, c.Eth, c.Eth, c.Eth)
	var out []interface{}
	err := contract.Call(&bind.CallOpts{Context: ctx}, &out, "getPoolBalance")
	if err != nil {
		return nil, fmt.Errorf("getPoolBalance: %w", err)
	}
	return out[0].(*big.Int), nil
}
