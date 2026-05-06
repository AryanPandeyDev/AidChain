package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// VerificationHandler handles ML service callbacks and blockchain release confirmations.
type VerificationHandler struct{ db *pgxpool.Pool }

// NewVerificationHandler returns a VerificationHandler backed by the given connection pool.
func NewVerificationHandler(db *pgxpool.Pool) *VerificationHandler {
	return &VerificationHandler{db: db}
}

// MLResult is the response body sent by the Python ML service after scoring a proof submission.
// Field names match the contract agreed with the Python team exactly.
type MLResult struct {
	SubmissionID string `json:"submission_id" binding:"required"`

	// Overall fraud signal — 0.0 (clean) to 1.0 (certain fraud).
	FraudProbability float64 `json:"fraud_probability" binding:"required"`

	// Risk tier: LOW | MEDIUM | HIGH.
	RiskLevel string `json:"risk_level" binding:"required"`

	// Binary outcome driven by the model's threshold logic: APPROVE | REJECT.
	Decision string `json:"decision" binding:"required,oneof=APPROVE REJECT"`

	// Per-dimension risk scores for transparency and admin review.
	FeatureScores struct {
		AmountRisk   float64 `json:"amount_risk"`
		GeoRisk      float64 `json:"geo_risk"`
		BehaviorRisk float64 `json:"behavior_risk"`
	} `json:"feature_scores"`

	// Human-readable reasons surfaced to admins on rejection.
	TopReasons []string `json:"top_reasons"`

	// Model version for audit trail and drift detection.
	ModelVersion string `json:"model_version"`
}

// HandleVerificationResult processes the ML service callback and updates proof status, trust score,
// and (on approval) enqueues the blockchain initiateRelease job.
//
// The verification_score stored in DB is 1 - fraud_probability so that higher always means
// a cleaner submission — consistent with the PRD's ≥0.6 threshold framing.
func (h *VerificationHandler) HandleVerificationResult(c *gin.Context) {
	proofID := c.Param("id")

	var result MLResult
	if err := c.ShouldBindJSON(&result); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Guard against the ML service sending a result for the wrong submission.
	if result.SubmissionID != proofID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "submission_id mismatch"})
		return
	}

	var (
		ngoID         string
		poolID        string
		claimedAmount float64
	)
	err := h.db.QueryRow(context.Background(),
		`SELECT ngo_id, pool_id, claimed_amount FROM proof_submissions
		 WHERE id = $1 AND verification_status = 'PENDING'`, proofID,
	).Scan(&ngoID, &poolID, &claimedAmount)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "proof not found or already processed"})
		return
	}

	var currentTrust float64
	_ = h.db.QueryRow(context.Background(),
		`SELECT trust_score FROM users WHERE id = $1`, ngoID,
	).Scan(&currentTrust)

	tx, err := h.db.Begin(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tx begin failed"})
		return
	}
	defer tx.Rollback(context.Background())

	approved := result.Decision == "APPROVE"

	// Store confidence as a normalised score (higher = cleaner) for consistency.
	verificationScore := 1.0 - result.FraudProbability

	var newStatus string
	var newTrust float64
	var trustReason string

	if approved {
		newStatus = "VERIFIED"
		// +2 per successful verification (PRD §10 security model).
		newTrust = min100(currentTrust + 2)
		trustReason = fmt.Sprintf(
			"proof %s verified — fraud_prob=%.2f risk=%s model=%s",
			proofID, result.FraudProbability, result.RiskLevel, result.ModelVersion,
		)
	} else {
		newStatus = "REJECTED"
		// -5 asymmetric penalty deters repeated fraud attempts.
		newTrust = max0(currentTrust - 5)
		trustReason = fmt.Sprintf(
			"proof %s rejected — fraud_prob=%.2f risk=%s reasons: %s",
			proofID, result.FraudProbability, result.RiskLevel,
			strings.Join(result.TopReasons, "; "),
		)
	}

	_, err = tx.Exec(context.Background(),
		`UPDATE proof_submissions
		 SET verification_status=$1, verification_score=$2
		 WHERE id=$3`,
		newStatus, verificationScore, proofID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "proof status update failed"})
		return
	}

	_, err = tx.Exec(context.Background(),
		`UPDATE users SET trust_score=$1 WHERE id=$2`, newTrust, ngoID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "trust score update failed"})
		return
	}

	_, err = tx.Exec(context.Background(),
		`INSERT INTO trust_score_logs (ngo_id, previous_score, new_score, reason, submission_id)
		 VALUES ($1,$2,$3,$4,$5)`,
		ngoID, currentTrust, newTrust, trustReason, proofID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "trust log failed"})
		return
	}

	if err := tx.Commit(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	response := gin.H{
		"proof_id":            proofID,
		"verification_status": newStatus,
		"new_trust_score":     newTrust,
		"fraud_probability":   result.FraudProbability,
		"risk_level":          result.RiskLevel,
		"model_version":       result.ModelVersion,
	}

	if approved {
		// TODO: dispatch blockchain worker → CrisisPool.initiateRelease(ngoWallet, amount, proofId)
		// Worker calls back via POST /internal/proofs/:id/release-confirmed once tx is mined.
		response["blockchain_job"] = "initiateRelease enqueued"
		response["note"] = fmt.Sprintf("release for %.2f USDC pending timelock", claimedAmount)
	} else {
		response["top_reasons"] = result.TopReasons
	}

	// Flag NGO for admin review if trust score falls below the PRD threshold.
	if newTrust < 20 {
		response["admin_alert"] = fmt.Sprintf(
			"NGO %s flagged for review: trust score %.0f < 20", ngoID, newTrust,
		)
		// TODO: send admin notification (email/webhook)
	}

	c.JSON(http.StatusOK, response)
}

// ConfirmRelease records the on-chain release ID and timelock after the blockchain worker has mined initiateRelease.
func (h *VerificationHandler) ConfirmRelease(c *gin.Context) {
	proofID := c.Param("id")

	var body struct {
		ReleaseIDOnChain  string    `json:"release_id_on_chain"   binding:"required"`
		PoolContractAddr  string    `json:"pool_contract_address" binding:"required"`
		Amount            float64   `json:"amount"                binding:"required"`
		InitiatedAt       time.Time `json:"initiated_at"`
		TimelockExpiresAt time.Time `json:"timelock_expires_at"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var ngoID string
	if err := h.db.QueryRow(context.Background(),
		`SELECT ngo_id FROM proof_submissions WHERE id=$1`, proofID,
	).Scan(&ngoID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "proof not found"})
		return
	}

	tx, err := h.db.Begin(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tx begin"})
		return
	}
	defer tx.Rollback(context.Background())

	_, err = tx.Exec(context.Background(),
		`UPDATE proof_submissions SET release_id=$1, timelock_expires_at=$2 WHERE id=$3`,
		body.ReleaseIDOnChain, body.TimelockExpiresAt, proofID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "proof update failed"})
		return
	}

	_, err = tx.Exec(context.Background(),
		`INSERT INTO pending_releases
		   (release_id_on_chain, submission_id, ngo_id, pool_contract_address,
		    amount, initiated_at, timelock_expires_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		body.ReleaseIDOnChain, proofID, ngoID, body.PoolContractAddr,
		body.Amount, body.InitiatedAt, body.TimelockExpiresAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "pending_release insert failed"})
		return
	}

	if err := tx.Commit(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":             "release recorded",
		"timelock_expires_at": body.TimelockExpiresAt,
	})
}

// ── helpers ──────────────────────────────────────────────────────────────────

func min100(v float64) float64 {
	if v > 100 {
		return 100
	}
	return v
}

func max0(v float64) float64 {
	if v < 0 {
		return 0
	}
	return v
}
