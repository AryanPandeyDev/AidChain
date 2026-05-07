package blockchain

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// Client wraps an Ethereum RPC connection and the two privileged wallets.
type Client struct {
	Eth          *ethclient.Client
	ChainID      *big.Int
	AdminKey     *ecdsa.PrivateKey
	AdminAddr    common.Address
	VerifierKey  *ecdsa.PrivateKey
	VerifierAddr common.Address
	FactoryAddr  common.Address
	FactoryABI   abi.ABI
	PoolABI      abi.ABI
}

// New creates a blockchain client from environment variables.
// Returns nil, nil if POLYGON_RPC_URL is not set (allows running without blockchain).
func New() (*Client, error) {
	rpcURL := os.Getenv("POLYGON_RPC_URL")
	if rpcURL == "" {
		log.Println("[blockchain] POLYGON_RPC_URL not set — blockchain features disabled")
		return nil, nil
	}

	eth, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("ethclient.Dial: %w", err)
	}

	chainID := new(big.Int)
	if s := os.Getenv("CHAIN_ID"); s != "" {
		chainID.SetString(s, 10)
	} else {
		chainID.SetInt64(137)
	}

	adminKey, err := loadPrivateKey("ADMIN_PRIVATE_KEY")
	if err != nil {
		return nil, fmt.Errorf("admin key: %w", err)
	}

	verifierKey, err := loadPrivateKey("VERIFIER_PRIVATE_KEY")
	if err != nil {
		return nil, fmt.Errorf("verifier key: %w", err)
	}

	factoryAddrStr := os.Getenv("POOL_FACTORY_ADDRESS")
	if factoryAddrStr == "" {
		return nil, fmt.Errorf("POOL_FACTORY_ADDRESS not set")
	}

	factoryABI, err := abi.JSON(strings.NewReader(PoolFactoryABIJSON))
	if err != nil {
		return nil, fmt.Errorf("parse factory ABI: %w", err)
	}

	poolABI, err := abi.JSON(strings.NewReader(CrisisPoolABIJSON))
	if err != nil {
		return nil, fmt.Errorf("parse pool ABI: %w", err)
	}

	c := &Client{
		Eth:          eth,
		ChainID:      chainID,
		AdminKey:     adminKey,
		AdminAddr:    crypto.PubkeyToAddress(adminKey.PublicKey),
		VerifierKey:  verifierKey,
		VerifierAddr: crypto.PubkeyToAddress(verifierKey.PublicKey),
		FactoryAddr:  common.HexToAddress(factoryAddrStr),
		FactoryABI:   factoryABI,
		PoolABI:      poolABI,
	}

	log.Printf("[blockchain] connected — chain=%s admin=%s verifier=%s factory=%s",
		chainID, c.AdminAddr.Hex(), c.VerifierAddr.Hex(), c.FactoryAddr.Hex())

	return c, nil
}

// AdminAuth returns a signed transactor for admin operations.
func (c *Client) AdminAuth(ctx context.Context) (*bind.TransactOpts, error) {
	auth, err := bind.NewKeyedTransactorWithChainID(c.AdminKey, c.ChainID)
	if err != nil {
		return nil, err
	}
	auth.Context = ctx
	return auth, nil
}

// VerifierAuth returns a signed transactor for verifier operations.
func (c *Client) VerifierAuth(ctx context.Context) (*bind.TransactOpts, error) {
	auth, err := bind.NewKeyedTransactorWithChainID(c.VerifierKey, c.ChainID)
	if err != nil {
		return nil, err
	}
	auth.Context = ctx
	return auth, nil
}

// USDCToOnChain converts a human-readable USDC amount (e.g. 50.0) to on-chain 6-decimal uint256.
func USDCToOnChain(amount float64) *big.Int {
	micro := int64(amount * 1e6)
	return big.NewInt(micro)
}

// USDCToHuman converts on-chain 6-decimal uint256 to human-readable float64.
func USDCToHuman(amount *big.Int) float64 {
	return float64(amount.Int64()) / 1e6
}

func loadPrivateKey(envVar string) (*ecdsa.PrivateKey, error) {
	raw := os.Getenv(envVar)
	if raw == "" {
		return nil, fmt.Errorf("%s not set", envVar)
	}
	raw = strings.TrimPrefix(raw, "0x")
	return crypto.HexToECDSA(raw)
}
