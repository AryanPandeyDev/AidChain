package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DonationHandler handles recording and querying USDC donations.
type DonationHandler struct{ db *pgxpool.Pool }

// NewDonationHandler returns a DonationHandler backed by the given connection pool.
func NewDonationHandler(db *pgxpool.Pool) *DonationHandler { return &DonationHandler{db: db} }

// RecordDonation persists a donation after the on-chain donate() transaction has been submitted.
func (h *DonationHandler) RecordDonation(c *gin.Context) {
	donorID, _ := c.Get("userID")

	var body struct {
		PoolID string  `json:"pool_id" binding:"required,uuid"`
		Amount float64 `json:"amount"  binding:"required,gt=0"`
		TxHash string  `json:"tx_hash" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, err := h.db.Begin(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tx begin failed"})
		return
	}
	defer tx.Rollback(context.Background())

	var donID string
	err = tx.QueryRow(context.Background(),
		`INSERT INTO donations (donor_id, pool_id, amount, tx_hash)
		 VALUES ($1,$2,$3,$4) RETURNING id`,
		donorID, body.PoolID, body.Amount, body.TxHash,
	).Scan(&donID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "donation insert failed"})
		return
	}

	// Mirror the on-chain balance in the off-chain funded_amount column.
	_, err = tx.Exec(context.Background(),
		`UPDATE crisis_pools SET funded_amount = funded_amount + $1 WHERE id = $2`,
		body.Amount, body.PoolID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "funded_amount update failed"})
		return
	}

	if err := tx.Commit(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"donation_id": donID})
}

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
