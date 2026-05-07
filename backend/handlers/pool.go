package handlers

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"aidchain/blockchain"
)

// PoolHandler handles crisis pool listing, detail retrieval, creation, and NGO assignment.
type PoolHandler struct {
	db *pgxpool.Pool
	bc *blockchain.Client
}

// NewPoolHandler returns a PoolHandler backed by the given connection pool and optional blockchain client.
func NewPoolHandler(db *pgxpool.Pool, bc *blockchain.Client) *PoolHandler {
	return &PoolHandler{db: db, bc: bc}
}

// ListPools returns all active crisis pools ordered by creation time descending.
func (h *PoolHandler) ListPools(c *gin.Context) {
	rows, err := h.db.Query(context.Background(),
		`SELECT id, name, description, region, target_amount,
		        contract_address, status, donations_paused, created_at
		 FROM crisis_pools
		 WHERE status = 'ACTIVE'
		 ORDER BY created_at DESC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type Pool struct {
		ID              string    `json:"id"`
		Name            string    `json:"name"`
		Description     string    `json:"description"`
		Region          string    `json:"region"`
		TargetAmount    float64   `json:"target_amount"`
		ContractAddress string    `json:"contract_address"`
		Status          string    `json:"status"`
		DonationsPaused bool      `json:"donations_paused"`
		CreatedAt       time.Time `json:"created_at"`
	}
	var pools []Pool
	for rows.Next() {
		var p Pool
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.Region, &p.TargetAmount,
			&p.ContractAddress, &p.Status, &p.DonationsPaused, &p.CreatedAt,
		); err != nil {
			continue
		}
		pools = append(pools, p)
	}
	c.JSON(http.StatusOK, gin.H{"pools": pools, "count": len(pools)})
}

// GetPool returns full details for a single crisis pool including assigned NGOs with trust scores.
// Financial state (balance, donationsPaused) is fetched live from the blockchain when available,
// while metadata (name, region, description) comes from the DB.
func (h *PoolHandler) GetPool(c *gin.Context) {
	id := c.Param("id")

	row := h.db.QueryRow(context.Background(),
		`SELECT id, name, description, region, region_lat, region_lng, region_radius_km,
		        target_amount, contract_address,
		        max_per_claim, max_per_ngo_per_day, max_per_ngo_pool,
		        donations_paused, status, created_at
		 FROM crisis_pools WHERE id = $1`, id)

	var p struct {
		ID               string     `json:"id"`
		Name             string     `json:"name"`
		Description      string     `json:"description"`
		Region           string     `json:"region"`
		RegionLat        *float64   `json:"region_lat"`
		RegionLng        *float64   `json:"region_lng"`
		RegionRadiusKm   *float64   `json:"region_radius_km"`
		TargetAmount     float64    `json:"target_amount"`
		ContractAddress  string     `json:"contract_address"`
		MaxPerClaim      float64    `json:"max_per_claim"`
		MaxPerNGOPerDay  float64    `json:"max_per_ngo_per_day"`
		MaxPerNGOPool    float64    `json:"max_per_ngo_pool"`
		DonationsPaused  bool       `json:"donations_paused"`
		Status           string     `json:"status"`
		CreatedAt        time.Time  `json:"created_at"`
		PoolBalance      *float64   `json:"pool_balance,omitempty"`
		NGOs             []ngoScore `json:"ngos"`
	}
	if err := row.Scan(
		&p.ID, &p.Name, &p.Description, &p.Region,
		&p.RegionLat, &p.RegionLng, &p.RegionRadiusKm,
		&p.TargetAmount, &p.ContractAddress,
		&p.MaxPerClaim, &p.MaxPerNGOPerDay, &p.MaxPerNGOPool,
		&p.DonationsPaused, &p.Status, &p.CreatedAt,
	); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "pool not found"})
		return
	}

	// Fetch live on-chain state when blockchain is available.
	// The chain is the source of truth for financial data; DB values are a cache.
	if h.bc != nil && p.ContractAddress != "" {
		poolAddr := common.HexToAddress(p.ContractAddress)

		// Live USDC balance from the contract.
		if balance, err := h.bc.GetPoolBalance(context.Background(), poolAddr); err == nil {
			bal := blockchain.USDCToHuman(balance)
			p.PoolBalance = &bal
		}

		// Live donationsPaused state from the contract.
		if paused, err := h.bc.GetDonationsPaused(context.Background(), poolAddr); err == nil {
			p.DonationsPaused = paused
		}
	}

	p.NGOs = fetchNGOsForPool(context.Background(), h.db, id)
	c.JSON(http.StatusOK, p)
}

type ngoScore struct {
	NgoID         string   `json:"ngo_user_id"`
	WalletAddress *string  `json:"wallet_address"`
	TrustScore    float64  `json:"trust_score"`
}

// fetchNGOsForPool queries trust scores for all NGOs assigned to a pool.
func fetchNGOsForPool(ctx context.Context, db *pgxpool.Pool, poolID string) []ngoScore {
	rows, err := db.Query(ctx,
		`SELECT u.id, u.wallet_address, u.trust_score
		 FROM pool_ngo_assignments pna
		 JOIN users u ON u.id = pna.ngo_user_id
		 WHERE pna.pool_id = $1`, poolID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var result []ngoScore
	for rows.Next() {
		var ns ngoScore
		if err := rows.Scan(&ns.NgoID, &ns.WalletAddress, &ns.TrustScore); err != nil {
			continue
		}
		result = append(result, ns)
	}
	return result
}

// CreatePool deploys a CrisisPool on-chain via PoolFactory.deployPool() and saves the metadata to DB.
// If blockchain is not configured, it accepts contract_address from the request body (MVP fallback).
func (h *PoolHandler) CreatePool(c *gin.Context) {
	adminID, _ := c.Get("userID")

	var body struct {
		Name             string  `json:"name"               binding:"required"`
		Description      string  `json:"description"        binding:"required"`
		Region           string  `json:"region"             binding:"required"`
		RegionLat        float64 `json:"region_lat"         binding:"required"`
		RegionLng        float64 `json:"region_lng"         binding:"required"`
		RegionRadiusKm   float64 `json:"region_radius_km"   binding:"required,gt=0"`
		TargetAmount     float64 `json:"target_amount"      binding:"required,gt=0"`
		ContractAddress  string  `json:"contract_address"`
		MaxPerClaim      float64 `json:"max_per_claim"      binding:"required,gt=0"`
		MaxPerNGOPerDay  float64 `json:"max_per_ngo_per_day" binding:"required,gt=0"`
		MaxPerNGOPool    float64 `json:"max_per_ngo_pool"   binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate cap relationships (must match smart contract invariants).
	if body.MaxPerNGOPerDay < body.MaxPerClaim {
		c.JSON(http.StatusBadRequest, gin.H{"error": "max_per_ngo_per_day must be >= max_per_claim"})
		return
	}
	if body.MaxPerNGOPool < body.MaxPerNGOPerDay {
		c.JSON(http.StatusBadRequest, gin.H{"error": "max_per_ngo_pool must be >= max_per_ngo_per_day"})
		return
	}

	contractAddress := body.ContractAddress

	// If blockchain is configured, deploy the pool on-chain and use the returned address.
	if h.bc != nil {
		maxPerClaim := blockchain.USDCToOnChain(body.MaxPerClaim)
		maxPerNGOPerDay := blockchain.USDCToOnChain(body.MaxPerNGOPerDay)
		maxPerNGOPool := blockchain.USDCToOnChain(body.MaxPerNGOPool)

		poolAddr, txHash, err := h.bc.DeployPool(context.Background(), maxPerClaim, maxPerNGOPerDay, maxPerNGOPool)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "on-chain deployPool failed: " + err.Error()})
			return
		}
		contractAddress = poolAddr.Hex()
		log.Printf("[blockchain] pool deployed at %s (tx: %s)", contractAddress, txHash)
	} else if contractAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "contract_address is required when blockchain is not configured"})
		return
	}

	var poolID string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO crisis_pools
		   (name, description, region, region_lat, region_lng, region_radius_km,
		    target_amount, contract_address,
		    max_per_claim, max_per_ngo_per_day, max_per_ngo_pool,
		    created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 RETURNING id`,
		body.Name, body.Description, body.Region,
		body.RegionLat, body.RegionLng, body.RegionRadiusKm,
		body.TargetAmount, contractAddress,
		body.MaxPerClaim, body.MaxPerNGOPerDay, body.MaxPerNGOPool,
		adminID,
	).Scan(&poolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "pool creation failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"pool_id": poolID, "contract_address": contractAddress})
}

// PausePool calls CrisisPool.pauseDonations() on-chain and updates the DB only on success.
func (h *PoolHandler) PausePool(c *gin.Context) {
	poolID := c.Param("id")

	var contractAddress string
	err := h.db.QueryRow(context.Background(),
		`SELECT contract_address FROM crisis_pools WHERE id=$1 AND status='ACTIVE'`,
		poolID,
	).Scan(&contractAddress)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "pool not found or not active"})
		return
	}

	// On-chain call — must succeed before we update DB.
	var chainNote string
	if h.bc != nil {
		txHash, err := h.bc.PauseDonations(context.Background(), common.HexToAddress(contractAddress))
		if err != nil {
			log.Printf("[blockchain] pauseDonations failed for pool %s: %v", poolID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "on-chain pause failed: " + err.Error()})
			return
		}
		chainNote = "on-chain pause tx: " + txHash
	} else {
		chainNote = "blockchain not configured — on-chain pause skipped"
	}

	_, err = h.db.Exec(context.Background(),
		`UPDATE crisis_pools SET donations_paused=true WHERE id=$1`,
		poolID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to pause pool"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "pool donations paused", "note": chainNote})
}

// ResumePool calls CrisisPool.resumeDonations() on-chain and updates the DB only on success.
func (h *PoolHandler) ResumePool(c *gin.Context) {
	poolID := c.Param("id")

	var contractAddress string
	err := h.db.QueryRow(context.Background(),
		`SELECT contract_address FROM crisis_pools WHERE id=$1 AND status='ACTIVE'`,
		poolID,
	).Scan(&contractAddress)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "pool not found or not active"})
		return
	}

	// On-chain call — must succeed before we update DB.
	var chainNote string
	if h.bc != nil {
		txHash, err := h.bc.ResumeDonations(context.Background(), common.HexToAddress(contractAddress))
		if err != nil {
			log.Printf("[blockchain] resumeDonations failed for pool %s: %v", poolID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "on-chain resume failed: " + err.Error()})
			return
		}
		chainNote = "on-chain resume tx: " + txHash
	} else {
		chainNote = "blockchain not configured — on-chain resume skipped"
	}

	_, err = h.db.Exec(context.Background(),
		`UPDATE crisis_pools SET donations_paused=false WHERE id=$1`,
		poolID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resume pool"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "pool donations resumed", "note": chainNote})
}
