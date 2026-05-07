package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TrustHandler handles NGO trust score retrieval.
type TrustHandler struct{ db *pgxpool.Pool }

// NewTrustHandler returns a TrustHandler backed by the given connection pool.
func NewTrustHandler(db *pgxpool.Pool) *TrustHandler { return &TrustHandler{db: db} }

// MyTrust returns the trust score and last 20 log entries for the authenticated NGO.
func (h *TrustHandler) MyTrust(c *gin.Context) {
	h.trustResponse(c, c.GetString("userID"))
}

// NgoTrust returns the public trust score and history for any NGO by ID.
func (h *TrustHandler) NgoTrust(c *gin.Context) {
	h.trustResponse(c, c.Param("ngoId"))
}

// trustResponse fetches and writes the trust score plus history for a given NGO.
func (h *TrustHandler) trustResponse(c *gin.Context, ngoID string) {
	var score float64
	if err := h.db.QueryRow(context.Background(),
		`SELECT trust_score FROM users WHERE id=$1 AND role='NGO'`, ngoID,
	).Scan(&score); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NGO not found"})
		return
	}

	rows, err := h.db.Query(context.Background(),
		`SELECT id, previous_score, new_score, reason, submission_id, created_at
		 FROM trust_score_logs WHERE ngo_user_id=$1 ORDER BY created_at DESC LIMIT 20`,
		ngoID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "log query failed"})
		return
	}
	defer rows.Close()

	type LogEntry struct {
		ID            string     `json:"id"`
		PreviousScore float64    `json:"previous_score"`
		NewScore      float64    `json:"new_score"`
		Reason        string     `json:"reason"`
		SubmissionID  *string    `json:"submission_id"`
		CreatedAt     time.Time  `json:"created_at"`
	}
	var history []LogEntry
	for rows.Next() {
		var e LogEntry
		if err := rows.Scan(&e.ID, &e.PreviousScore, &e.NewScore, &e.Reason, &e.SubmissionID, &e.CreatedAt); err != nil {
			continue
		}
		history = append(history, e)
	}

	c.JSON(http.StatusOK, gin.H{
		"ngo_id":      ngoID,
		"trust_score": score,
		"history":     history,
	})
}
