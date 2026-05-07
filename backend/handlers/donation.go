package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DonationHandler handles querying USDC donations.
// Donations are recorded via the blockchain event listener, not via a POST endpoint.
type DonationHandler struct{ db *pgxpool.Pool }

// NewDonationHandler returns a DonationHandler backed by the given connection pool.
func NewDonationHandler(db *pgxpool.Pool) *DonationHandler { return &DonationHandler{db: db} }

// MyDonations returns all donations made by the authenticated donor.
func (h *DonationHandler) MyDonations(c *gin.Context) {
	donorID, _ := c.Get("userID")
	rows, err := h.db.Query(context.Background(),
		`SELECT d.id, d.pool_id, cp.name, d.amount, d.tx_hash, d.created_at
		 FROM donations d
		 JOIN crisis_pools cp ON cp.id = d.pool_id
		 WHERE d.donor_id = $1
		 ORDER BY d.created_at DESC`,
		donorID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type Don struct {
		ID        string    `json:"id"`
		PoolID    string    `json:"pool_id"`
		PoolName  string    `json:"pool_name"`
		Amount    float64   `json:"amount"`
		TxHash    string    `json:"tx_hash"`
		CreatedAt time.Time `json:"created_at"`
	}
	var result []Don
	for rows.Next() {
		var d Don
		if err := rows.Scan(&d.ID, &d.PoolID, &d.PoolName, &d.Amount, &d.TxHash, &d.CreatedAt); err != nil {
			continue
		}
		result = append(result, d)
	}
	c.JSON(http.StatusOK, gin.H{"donations": result})
}

// PoolDonations returns all donations made to a specific crisis pool.
func (h *DonationHandler) PoolDonations(c *gin.Context) {
	poolID := c.Param("poolId")
	rows, err := h.db.Query(context.Background(),
		`SELECT id, donor_id, amount, tx_hash, created_at
		 FROM donations WHERE pool_id = $1 ORDER BY created_at DESC`,
		poolID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type Don struct {
		ID        string    `json:"id"`
		DonorID   string    `json:"donor_id"`
		Amount    float64   `json:"amount"`
		TxHash    string    `json:"tx_hash"`
		CreatedAt time.Time `json:"created_at"`
	}
	var result []Don
	for rows.Next() {
		var d Don
		if err := rows.Scan(&d.ID, &d.DonorID, &d.Amount, &d.TxHash, &d.CreatedAt); err != nil {
			continue
		}
		result = append(result, d)
	}
	c.JSON(http.StatusOK, gin.H{"donations": result})
}
