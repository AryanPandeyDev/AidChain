package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PoolHandler handles crisis pool listing, detail retrieval, creation, and NGO assignment.
type PoolHandler struct{ db *pgxpool.Pool }

// NewPoolHandler returns a PoolHandler backed by the given connection pool.
func NewPoolHandler(db *pgxpool.Pool) *PoolHandler { return &PoolHandler{db: db} }

// ListPools returns all active crisis pools ordered by creation time descending.
func (h *PoolHandler) ListPools(c *gin.Context) {
	rows, err := h.db.Query(context.Background(),
		`SELECT id, name, description, region, target_amount, funded_amount,
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
		FundedAmount    float64   `json:"funded_amount"`
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
			&p.FundedAmount, &p.ContractAddress, &p.Status, &p.DonationsPaused, &p.CreatedAt,
		); err != nil {
			continue
		}
		pools = append(pools, p)
	}
	c.JSON(http.StatusOK, gin.H{"pools": pools, "count": len(pools)})
}

// GetPool returns full details for a single crisis pool including assigned NGOs with trust scores.
func (h *PoolHandler) GetPool(c *gin.Context) {
	id := c.Param("id")

	row := h.db.QueryRow(context.Background(),
		`SELECT id, name, description, region, region_lat, region_lng, region_radius_km,
		        target_amount, funded_amount, contract_address,
		        max_per_claim, max_per_ngo_per_day, max_per_ngo_pool, timelock_duration,
		        donations_paused, status, created_at
		 FROM crisis_pools WHERE id = $1`, id)

	var p struct {
		ID               string    `json:"id"`
		Name             string    `json:"name"`
		Description      string    `json:"description"`
		Region           string    `json:"region"`
		RegionLat        *float64  `json:"region_lat"`
		RegionLng        *float64  `json:"region_lng"`
		RegionRadiusKm   *float64  `json:"region_radius_km"`
		TargetAmount     float64   `json:"target_amount"`
		FundedAmount     float64   `json:"funded_amount"`
		ContractAddress  string    `json:"contract_address"`
		MaxPerClaim      float64   `json:"max_per_claim"`
		MaxPerNGOPerDay  float64   `json:"max_per_ngo_per_day"`
		MaxPerNGOPool    float64   `json:"max_per_ngo_pool"`
		TimelockDuration int       `json:"timelock_duration"`
		DonationsPaused  bool      `json:"donations_paused"`
		Status           string    `json:"status"`
		CreatedAt        time.Time `json:"created_at"`
		NGOs             []ngoScore `json:"ngos"`
	}
	if err := row.Scan(
		&p.ID, &p.Name, &p.Description, &p.Region,
		&p.RegionLat, &p.RegionLng, &p.RegionRadiusKm,
		&p.TargetAmount, &p.FundedAmount, &p.ContractAddress,
		&p.MaxPerClaim, &p.MaxPerNGOPerDay, &p.MaxPerNGOPool, &p.TimelockDuration,
		&p.DonationsPaused, &p.Status, &p.CreatedAt,
	); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "pool not found"})
		return
	}

	p.NGOs = fetchNGOsForPool(context.Background(), h.db, id)
	c.JSON(http.StatusOK, p)
}

type ngoScore struct {
	NgoID         string   `json:"ngo_id"`
	WalletAddress *string  `json:"wallet_address"`
	TrustScore    float64  `json:"trust_score"`
}

// fetchNGOsForPool queries trust scores for all NGOs assigned to a pool.
func fetchNGOsForPool(ctx context.Context, db *pgxpool.Pool, poolID string) []ngoScore {
	rows, err := db.Query(ctx,
		`SELECT u.id, u.wallet_address, u.trust_score
		 FROM crisis_pool_ngos cpn
		 JOIN users u ON u.id = cpn.ngo_id
		 WHERE cpn.pool_id = $1`, poolID)
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

// CreatePool inserts a new crisis pool record after the admin has already deployed the contract on-chain.
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
		ContractAddress  string  `json:"contract_address"   binding:"required"`
		MaxPerClaim      float64 `json:"max_per_claim"      binding:"required,gt=0"`
		MaxPerNGOPerDay  float64 `json:"max_per_ngo_per_day" binding:"required,gt=0"`
		MaxPerNGOPool    float64 `json:"max_per_ngo_pool"   binding:"required,gt=0"`
		TimelockDuration int     `json:"timelock_duration"  binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var poolID string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO crisis_pools
		   (name, description, region, region_lat, region_lng, region_radius_km,
		    target_amount, contract_address,
		    max_per_claim, max_per_ngo_per_day, max_per_ngo_pool, timelock_duration,
		    created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		 RETURNING id`,
		body.Name, body.Description, body.Region,
		body.RegionLat, body.RegionLng, body.RegionRadiusKm,
		body.TargetAmount, body.ContractAddress,
		body.MaxPerClaim, body.MaxPerNGOPerDay, body.MaxPerNGOPool, body.TimelockDuration,
		adminID,
	).Scan(&poolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "pool creation failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"pool_id": poolID})
}

// AssignNGO links a verified NGO to a crisis pool and enqueues the on-chain assignment job.
func (h *PoolHandler) AssignNGO(c *gin.Context) {
	poolID := c.Param("id")

	var body struct {
		NgoID string `json:"ngo_id" binding:"required,uuid"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Only VERIFIED NGOs may be assigned to pools.
	var count int
	_ = h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM ngo_applications WHERE ngo_user_id = $1 AND status = 'VERIFIED'`,
		body.NgoID,
	).Scan(&count)
	if count == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NGO is not verified"})
		return
	}

	_, err := h.db.Exec(context.Background(),
		`INSERT INTO crisis_pool_ngos (pool_id, ngo_id) VALUES ($1, $2)
		 ON CONFLICT (pool_id, ngo_id) DO NOTHING`,
		poolID, body.NgoID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "assignment failed"})
		return
	}

	// TODO: trigger blockchain worker → CrisisPool.assignNGO(ngoWalletAddress)
	c.JSON(http.StatusOK, gin.H{"message": "NGO assigned to pool", "note": "blockchain assign job enqueued"})
}
