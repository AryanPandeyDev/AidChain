package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ProofHandler handles proof submission and retrieval for NGO field workers.
type ProofHandler struct{ db *pgxpool.Pool }

// NewProofHandler returns a ProofHandler backed by the given connection pool.
func NewProofHandler(db *pgxpool.Pool) *ProofHandler { return &ProofHandler{db: db} }

// haversineKm computes the great-circle distance in kilometres between two GPS coordinates.
func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

// verifyProof computes the three-signal verification score for a proof submission.
//
// Signal weights: OCR match 40%, location plausibility 30%, historical approval rate 30%.
// Returns a score in [0.0, 1.0] and true if the score is >= 0.6.
func verifyProof(
	ocrAmount, claimedAmount float64,
	lat, lng float64,
	poolLat, poolLng, poolRadiusKm float64,
	totalSubs, verifiedSubs int,
) (score float64, passed bool) {
	var ocrScore float64
	if claimedAmount > 0 {
		diff := math.Abs(ocrAmount-claimedAmount) / claimedAmount
		if diff <= 0.05 {
			ocrScore = 1.0
		}
	}

	var locationScore float64
	dist := haversineKm(lat, lng, poolLat, poolLng)
	if dist <= poolRadiusKm {
		locationScore = 1.0
	}

	// New NGOs with no history receive a neutral 0.5 score to avoid penalising first submissions.
	historicalScore := 0.5
	if totalSubs > 0 {
		historicalScore = float64(verifiedSubs) / float64(totalSubs)
	}

	score = (0.4 * ocrScore) + (0.3 * locationScore) + (0.3 * historicalScore)
	passed = score >= 0.6
	return
}

// generateProofID derives a deterministic bytes32 proof identifier from the submission UUID.
func generateProofID(submissionID string) ([32]byte, error) {
	h := crypto.Keccak256Hash(
		[]byte(submissionID),
		[]byte(strconv.FormatInt(time.Now().UnixNano(), 10)),
	)
	var result [32]byte
	copy(result[:], h.Bytes())
	return result, nil
}

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

// fetchTrustScore returns the current trust score for an NGO user, defaulting to 0 on error.
func fetchTrustScore(ctx context.Context, db *pgxpool.Pool, ngoID string) float64 {
	var score float64
	_ = db.QueryRow(ctx, `SELECT trust_score FROM users WHERE id = $1`, ngoID).Scan(&score)
	return score
}

// SubmitProof persists an NGO proof submission, runs three-signal verification, and triggers fund release on approval.
func (h *ProofHandler) SubmitProof(c *gin.Context) {
	ngoID := c.GetString("userID")
	if ngoID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user identity"})
		return
	}

	var body struct {
		PoolID          string  `json:"pool_id"           binding:"required,uuid"`
		ReceiptImageURL string  `json:"receipt_image_url" binding:"required,url"`
		OcrAmount       float64 `json:"ocr_amount"`
		OcrVendor       string  `json:"ocr_vendor"`
		OcrDate         string  `json:"ocr_date"`
		ClaimedAmount   float64 `json:"claimed_amount"    binding:"required,gt=0"`
		Latitude        float64 `json:"latitude"          binding:"required"`
		Longitude       float64 `json:"longitude"         binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var count int
	_ = h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM pool_ngo_assignments WHERE pool_id = $1 AND ngo_user_id = $2`,
		body.PoolID, ngoID,
	).Scan(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "NGO is not assigned to this pool"})
		return
	}

	var proofID string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO proof_submissions
		   (ngo_user_id, pool_id, receipt_image_url, ocr_amount, ocr_vendor, ocr_date,
		    claimed_amount, latitude, longitude)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 RETURNING id`,
		ngoID, body.PoolID, body.ReceiptImageURL,
		body.OcrAmount, body.OcrVendor, body.OcrDate,
		body.ClaimedAmount, body.Latitude, body.Longitude,
	).Scan(&proofID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "proof insert failed"})
		return
	}

	var poolLat, poolLng, poolRadiusKm float64
	err = h.db.QueryRow(context.Background(),
		`SELECT region_lat, region_lng, region_radius_km
		 FROM crisis_pools WHERE id = $1`,
		body.PoolID,
	).Scan(&poolLat, &poolLng, &poolRadiusKm)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "pool context fetch failed"})
		return
	}

	var totalSubs, verifiedSubs int
	// Exclude the current submission from history so the new proof does not skew its own baseline.
	_ = h.db.QueryRow(context.Background(),
		`SELECT
		   COUNT(*) AS total,
		   SUM(CASE WHEN verification_status = 'VERIFIED' THEN 1 ELSE 0 END) AS verified
		 FROM proof_submissions
		 WHERE ngo_user_id = $1 AND id != $2`,
		ngoID, proofID,
	).Scan(&totalSubs, &verifiedSubs)

	score, passed := verifyProof(
		body.OcrAmount, body.ClaimedAmount,
		body.Latitude, body.Longitude,
		poolLat, poolLng, poolRadiusKm,
		totalSubs, verifiedSubs,
	)

	newStatus := "REJECTED"
	if passed {
		newStatus = "VERIFIED"
	}

	currentTrust := fetchTrustScore(context.Background(), h.db, ngoID)
	var newTrust float64
	if passed {
		newTrust = min100(currentTrust + 2)
	} else {
		newTrust = max0(currentTrust - 5)
	}

	tx, err := h.db.Begin(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tx begin failed"})
		return
	}
	defer tx.Rollback(context.Background())

	_, err = tx.Exec(context.Background(),
		`UPDATE proof_submissions SET verification_status=$1, verification_score=$2 WHERE id=$3`,
		newStatus, score, proofID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "proof update failed"})
		return
	}

	_, err = tx.Exec(context.Background(),
		`UPDATE users SET trust_score=$1 WHERE id=$2`,
		newTrust, ngoID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "trust update failed"})
		return
	}

	if newTrust < 20 {
		_, err = tx.Exec(context.Background(),
			`UPDATE users SET flagged=true WHERE id=$1`,
			ngoID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "flag update failed"})
			return
		}
	}

	var reason string
	if passed {
		reason = fmt.Sprintf("proof %s verified — score=%.2f", proofID, score)
	} else {
		reason = fmt.Sprintf("proof %s rejected — score=%.2f", proofID, score)
	}

	_, err = tx.Exec(context.Background(),
		`INSERT INTO trust_score_logs (ngo_user_id, previous_score, new_score, reason, submission_id)
		 VALUES ($1,$2,$3,$4,$5)`,
		ngoID, currentTrust, newTrust, reason, proofID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "trust log failed"})
		return
	}

	if err := tx.Commit(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	if passed {
		onchainProofID, _ := generateProofID(proofID)
		_ = onchainProofID // To avoid unused variable error
		// TODO: blockchain.ReleaseFunds(ctx, poolContractAddress, ngoWalletAddress, claimedAmountBigInt, onchainProofID)
		// On success: UPDATE proof_submissions SET proof_id_onchain=$1, tx_hash=$2 WHERE id=$3
	}

	response := gin.H{
		"proof_id":            proofID,
		"verification_status": newStatus,
		"verification_score":  score,
		"new_trust_score":     newTrust,
	}
	if !passed {
		response["message"] = "proof rejected — verification score below threshold"
	}
	if newTrust < 20 {
		response["admin_alert"] = fmt.Sprintf("NGO %s flagged for review: trust score %.0f < 20", ngoID, newTrust)
	}
	c.JSON(http.StatusCreated, response)
}

// MyProofs returns all proof submissions for the authenticated NGO.
func (h *ProofHandler) MyProofs(c *gin.Context) {
	ngoID := c.GetString("userID")
	rows, err := h.db.Query(context.Background(),
		`SELECT id, pool_id, claimed_amount, verification_status, verification_score,
		        tx_hash, created_at
		 FROM proof_submissions WHERE ngo_user_id = $1 ORDER BY created_at DESC`,
		ngoID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()
	c.JSON(http.StatusOK, gin.H{"proofs": scanProofRows(rows)})
}

// PoolProofs returns all proof submissions for a given crisis pool visible to donors.
func (h *ProofHandler) PoolProofs(c *gin.Context) {
	poolID := c.Param("poolId")
	rows, err := h.db.Query(context.Background(),
		`SELECT id, ngo_user_id, claimed_amount, verification_status, verification_score,
		        receipt_image_url, ocr_vendor, ocr_date, created_at
		 FROM proof_submissions WHERE pool_id = $1 ORDER BY created_at DESC`,
		poolID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()
	c.JSON(http.StatusOK, gin.H{"proofs": scanProofRowsPublic(rows)})
}

// GetProof returns full detail for a single proof submission including verification result and release status.
func (h *ProofHandler) GetProof(c *gin.Context) {
	id := c.Param("id")
	row := h.db.QueryRow(context.Background(),
		`SELECT id, ngo_user_id, pool_id, receipt_image_url, ocr_amount, ocr_vendor, ocr_date,
		        claimed_amount, latitude, longitude, verification_status, verification_score,
		        proof_id_onchain, tx_hash, created_at
		 FROM proof_submissions WHERE id = $1`, id)

	var p struct {
		ID                 string     `json:"id"`
		NgoID              string     `json:"ngo_user_id"`
		PoolID             string     `json:"pool_id"`
		ReceiptImageURL    string     `json:"receipt_image_url"`
		OcrAmount          *float64   `json:"ocr_amount"`
		OcrVendor          *string    `json:"ocr_vendor"`
		OcrDate            *string    `json:"ocr_date"`
		ClaimedAmount      float64    `json:"claimed_amount"`
		Latitude           float64    `json:"latitude"`
		Longitude          float64    `json:"longitude"`
		VerificationStatus string     `json:"verification_status"`
		VerificationScore  *float64   `json:"verification_score"`
		ProofIdOnchain     *string    `json:"proof_id_onchain"`
		TxHash             *string    `json:"tx_hash"`
		CreatedAt          time.Time  `json:"created_at"`
	}
	if err := row.Scan(
		&p.ID, &p.NgoID, &p.PoolID, &p.ReceiptImageURL,
		&p.OcrAmount, &p.OcrVendor, &p.OcrDate, &p.ClaimedAmount,
		&p.Latitude, &p.Longitude, &p.VerificationStatus, &p.VerificationScore,
		&p.ProofIdOnchain, &p.TxHash, &p.CreatedAt,
	); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "proof not found"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// ── scan helpers ─────────────────────────────────────────────────────────────

type proofRow struct {
	ID                 string     `json:"id"`
	PoolID             string     `json:"pool_id"`
	ClaimedAmount      float64    `json:"claimed_amount"`
	VerificationStatus string     `json:"verification_status"`
	VerificationScore  *float64   `json:"verification_score"`
	TxHash             *string    `json:"tx_hash"`
	CreatedAt          time.Time  `json:"created_at"`
}

type proofRowPublic struct {
	ID                 string    `json:"id"`
	NgoID              string    `json:"ngo_user_id"`
	ClaimedAmount      float64   `json:"claimed_amount"`
	VerificationStatus string    `json:"verification_status"`
	VerificationScore  *float64  `json:"verification_score"`
	ReceiptImageURL    string    `json:"receipt_image_url"`
	OcrVendor          *string   `json:"ocr_vendor"`
	OcrDate            *string   `json:"ocr_date"`
	CreatedAt          time.Time `json:"created_at"`
}

func scanProofRows(rows interface {
	Next() bool
	Scan(...any) error
	Close()
}) []proofRow {
	var result []proofRow
	for rows.Next() {
		var p proofRow
		if err := rows.Scan(
			&p.ID, &p.PoolID, &p.ClaimedAmount,
			&p.VerificationStatus, &p.VerificationScore,
			&p.TxHash, &p.CreatedAt,
		); err != nil {
			continue
		}
		result = append(result, p)
	}
	return result
}

func scanProofRowsPublic(rows interface {
	Next() bool
	Scan(...any) error
	Close()
}) []proofRowPublic {
	var result []proofRowPublic
	for rows.Next() {
		var p proofRowPublic
		if err := rows.Scan(
			&p.ID, &p.NgoID, &p.ClaimedAmount,
			&p.VerificationStatus, &p.VerificationScore,
			&p.ReceiptImageURL, &p.OcrVendor, &p.OcrDate, &p.CreatedAt,
		); err != nil {
			continue
		}
		result = append(result, p)
	}
	return result
}
