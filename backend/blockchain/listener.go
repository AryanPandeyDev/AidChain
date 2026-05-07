package blockchain

import (
	"context"
	"fmt"
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

	// Ensure the cursor row exists so the first poll doesn't fail.
	_, _ = db.Exec(ctx, `INSERT INTO event_sync_cursor (id, last_block) VALUES (1, 0) ON CONFLICT DO NOTHING`)

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
	fundsReleasedID := bc.PoolABI.Events["FundsReleased"].ID
	ngoAssignedID := bc.PoolABI.Events["NGOAssigned"].ID
	donationsPausedID := bc.PoolABI.Events["DonationsPausedEvent"].ID
	donationsResumedID := bc.PoolABI.Events["DonationsResumedEvent"].ID

	for _, vLog := range logs {
		if len(vLog.Topics) == 0 {
			continue
		}
		switch vLog.Topics[0] {
		case donationReceivedID:
			processDonationReceived(ctx, db, bc, vLog.Address, vLog.Topics, vLog.Data, vLog.TxHash)
		case fundsReleasedID:
			processFundsReleased(ctx, db, bc, vLog.Address, vLog.Topics, vLog.Data, vLog.TxHash)
		case ngoAssignedID:
			processNGOAssigned(ctx, db, vLog.Address, vLog.Topics)
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

func processDonationReceived(ctx context.Context, db *pgxpool.Pool, bc *Client, poolAddr common.Address, topics []common.Hash, data []byte, txHash common.Hash) {
	if len(topics) < 2 {
		return
	}
	donorAddr := common.HexToAddress(topics[1].Hex())

	// Decode amount from non-indexed event data.
	nonIndexedArgs := bc.PoolABI.Events["DonationReceived"].Inputs.NonIndexed()
	values, err := nonIndexedArgs.Unpack(data)
	if err != nil || len(values) == 0 {
		log.Printf("[event-listener] failed to decode DonationReceived data: %v", err)
		return
	}
	amount, ok := values[0].(*big.Int)
	if !ok {
		return
	}
	amountHuman := USDCToHuman(amount)

	// Find the pool ID in our DB by contract address.
	var poolID string
	err = db.QueryRow(ctx,
		`SELECT id FROM crisis_pools WHERE LOWER(contract_address) = LOWER($1)`,
		poolAddr.Hex(),
	).Scan(&poolID)
	if err != nil {
		return
	}

	// Look up the donor's user UUID by wallet address (donor_id is a FK to users.id).
	var donorUserID string
	err = db.QueryRow(ctx,
		`SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1)`,
		donorAddr.Hex(),
	).Scan(&donorUserID)
	if err != nil {
		log.Printf("[event-listener] donor wallet %s not found in users table — skipping donation record", donorAddr.Hex())
		return
	}

	// Upsert the donation (idempotent by tx_hash).
	_, _ = db.Exec(ctx,
		`INSERT INTO donations (donor_id, pool_id, amount, tx_hash)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (tx_hash) DO NOTHING`,
		donorUserID, poolID, amountHuman, txHash.Hex(),
	)
}

// processFundsReleased handles on-chain FundsReleased events. Reconciles with the DB
// in case the backend missed updating the proof submission after releaseFunds() succeeded.
func processFundsReleased(ctx context.Context, db *pgxpool.Pool, bc *Client, poolAddr common.Address, topics []common.Hash, data []byte, txHash common.Hash) {
	if len(topics) < 2 {
		return
	}
	// Decode non-indexed data: amount (uint256) and proofId (bytes32).
	nonIndexed := bc.PoolABI.Events["FundsReleased"].Inputs.NonIndexed()
	values, err := nonIndexed.Unpack(data)
	if err != nil || len(values) < 2 {
		log.Printf("[event-listener] failed to decode FundsReleased data: %v", err)
		return
	}
	proofId, ok := values[1].([32]byte)
	if !ok {
		return
	}
	proofIdHex := fmt.Sprintf("0x%x", proofId)

	// If proof submission exists and doesn't have a tx_hash, update it.
	_, _ = db.Exec(ctx,
		`UPDATE proof_submissions SET verification_status='VERIFIED', tx_hash=$1
		 WHERE proof_id_onchain=$2 AND tx_hash IS NULL`,
		txHash.Hex(), proofIdHex,
	)
}

// processNGOAssigned syncs on-chain NGOAssigned events to the DB.
func processNGOAssigned(ctx context.Context, db *pgxpool.Pool, poolAddr common.Address, topics []common.Hash) {
	if len(topics) < 2 {
		return
	}
	ngoAddr := common.HexToAddress(topics[1].Hex())

	var poolID, ngoUserID string
	err := db.QueryRow(ctx,
		`SELECT id FROM crisis_pools WHERE LOWER(contract_address) = LOWER($1)`,
		poolAddr.Hex(),
	).Scan(&poolID)
	if err != nil {
		return
	}
	err = db.QueryRow(ctx,
		`SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1)`,
		ngoAddr.Hex(),
	).Scan(&ngoUserID)
	if err != nil {
		return
	}

	// Idempotent: insert assignment if not already present.
	_, _ = db.Exec(ctx,
		`INSERT INTO pool_ngo_assignments (pool_id, ngo_user_id)
		 VALUES ($1, $2)
		 ON CONFLICT (pool_id, ngo_user_id) DO NOTHING`,
		poolID, ngoUserID,
	)
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
