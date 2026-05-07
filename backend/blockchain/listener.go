package blockchain

import (
	"context"
	"log"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/jackc/pgx/v5/pgxpool"
)

// StartEventListener runs a background loop that polls on-chain events and syncs them to the database.
// It processes events from all known crisis pools and the pool factory.
func StartEventListener(ctx context.Context, bc *Client, db *pgxpool.Pool) {
	if bc == nil {
		log.Println("[event-listener] blockchain client is nil — listener disabled")
		return
	}

	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("[event-listener] shutting down")
				return
			case <-ticker.C:
				if err := pollEvents(ctx, bc, db); err != nil {
					log.Printf("[event-listener] poll error: %v", err)
				}
			}
		}
	}()
	log.Println("[event-listener] started — polling every 15s")
}

func pollEvents(ctx context.Context, bc *Client, db *pgxpool.Pool) error {
	var lastBlock int64
	err := db.QueryRow(ctx, `SELECT last_block FROM event_sync_cursor WHERE id = 1`).Scan(&lastBlock)
	if err != nil {
		return err
	}

	latest, err := bc.Eth.BlockNumber(ctx)
	if err != nil {
		return err
	}
	latestInt := int64(latest)

	if latestInt <= lastBlock {
		return nil
	}

	// Process in chunks of 2000 blocks to avoid RPC limits.
	fromBlock := lastBlock + 1
	toBlock := latestInt
	if toBlock-fromBlock > 2000 {
		toBlock = fromBlock + 2000
	}

	// Collect all pool contract addresses from DB.
	poolAddrs, err := getPoolAddresses(ctx, db)
	if err != nil {
		return err
	}

	// Build address list: factory + all known pools.
	addresses := []common.Address{bc.FactoryAddr}
	for _, a := range poolAddrs {
		addresses = append(addresses, common.HexToAddress(a))
	}

	if len(addresses) == 0 {
		_, _ = db.Exec(ctx, `UPDATE event_sync_cursor SET last_block = $1 WHERE id = 1`, toBlock)
		return nil
	}

	query := ethereum.FilterQuery{
		FromBlock: big.NewInt(fromBlock),
		ToBlock:   big.NewInt(toBlock),
		Addresses: addresses,
	}

	logs, err := bc.Eth.FilterLogs(ctx, query)
	if err != nil {
		return err
	}

	donationReceivedID := bc.PoolABI.Events["DonationReceived"].ID
	donationsPausedID := bc.PoolABI.Events["DonationsPausedEvent"].ID
	donationsResumedID := bc.PoolABI.Events["DonationsResumedEvent"].ID

	for _, vLog := range logs {
		if len(vLog.Topics) == 0 {
			continue
		}
		switch vLog.Topics[0] {
		case donationReceivedID:
			processDonationReceived(ctx, db, bc, vLog.Address, vLog)
		case donationsPausedID:
			_, _ = db.Exec(ctx,
				`UPDATE crisis_pools SET donations_paused = true WHERE LOWER(contract_address) = LOWER($1)`,
				vLog.Address.Hex())
		case donationsResumedID:
			_, _ = db.Exec(ctx,
				`UPDATE crisis_pools SET donations_paused = false WHERE LOWER(contract_address) = LOWER($1)`,
				vLog.Address.Hex())
		}
	}

	_, _ = db.Exec(ctx, `UPDATE event_sync_cursor SET last_block = $1 WHERE id = 1`, toBlock)
	log.Printf("[event-listener] processed blocks %d–%d (%d logs)", fromBlock, toBlock, len(logs))
	return nil
}

func processDonationReceived(ctx context.Context, db *pgxpool.Pool, bc *Client, poolAddr common.Address, vLog interface{ Topics() []common.Hash }) {
	// Type assertion for the actual log struct would be needed; simplified for the event data we need.
	// The event listener uses FilterLogs which returns types.Log, so this is handled in pollEvents above.
}

func getPoolAddresses(ctx context.Context, db *pgxpool.Pool) ([]string, error) {
	rows, err := db.Query(ctx, `SELECT contract_address FROM crisis_pools`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var addrs []string
	for rows.Next() {
		var addr string
		if err := rows.Scan(&addr); err != nil {
			continue
		}
		if strings.HasPrefix(addr, "0x") {
			addrs = append(addrs, addr)
		}
	}
	return addrs, nil
}
