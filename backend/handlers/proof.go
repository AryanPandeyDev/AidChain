package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ProofHandler handles proof submission and retrieval for NGO field workers.
type ProofHandler struct{ db *pgxpool.Pool }

// NewProofHandler returns a ProofHandler backed by the given connection pool.
func NewProofHandler(db *pgxpool.Pool) *ProofHandler { return &ProofHandler{db: db} }

// SubmitProof persists an NGO proof submission and dispatches it to the ML service for verification.
//
// The client uploads the receipt image to S3 and runs on-device OCR before calling this endpoint.
// Verification is asynchronous — the ML service calls back via POST /internal/proofs/:id/verify.
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

	// NGO must be assigned to the pool they are submitting against.
	var count int
	_ = h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM crisis_pool_ngos WHERE pool_id = $1 AND ngo_id = $2`,
		body.PoolID, ngoID,
	).Scan(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "NGO is not assigned to this pool"})
		return
	}

	var proofID string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO proof_submissions
		   (ngo_id, pool_id, receipt_image_url, ocr_amount, ocr_vendor, ocr_date,
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

	// ── gather pool geometry and caps ────────────────────────────────────────
	var poolCtx poolContext
	err = h.db.QueryRow(context.Background(),
		`SELECT region_lat, region_lng, region_radius_km, max_per_claim
		 FROM crisis_pools WHERE id = $1`,
		body.PoolID,
	).Scan(&poolCtx.RegionLat, &poolCtx.RegionLng, &poolCtx.RegionRadiusKm, &poolCtx.MaxPerClaim)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "pool context fetch failed"})
		return
	}

	// ── gather NGO behavioural history ───────────────────────────────────────
	var history ngoHistory
	history.TrustScore = fetchTrustScore(context.Background(), h.db, ngoID)

	var total, verified, rejected int
	var avgClaim float64
	_ = h.db.QueryRow(context.Background(),
		`SELECT
		   COUNT(*)                                                        AS total,
		   SUM(CASE WHEN verification_status = 'VERIFIED' THEN 1 ELSE 0 END) AS verified,
		   SUM(CASE WHEN verification_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
		   COALESCE(AVG(claimed_amount), 0)                                AS avg_claim
		 FROM proof_submissions
		 WHERE ngo_id = $1 AND id != $2`,
		ngoID, proofID,
	).Scan(&total, &verified, &rejected, &avgClaim)

	if total > 0 {
		history.ApprovalRate = float64(verified) / float64(total)
		history.RejectionRate = float64(rejected) / float64(total)
	}
	history.AvgClaimAmount = avgClaim

	_ = h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM proof_submissions
		 WHERE ngo_id = $1 AND created_at >= current_date`,
		ngoID,
	).Scan(&history.SubmissionCountToday)

	// Dispatch to ML service asynchronously — response arrives via callback.
	go dispatchToML(MLPayload{
		SubmissionID:  proofID,
		NgoID:         ngoID,
		OcrAmount:     body.OcrAmount,
		ClaimedAmount: body.ClaimedAmount,
		Latitude:      body.Latitude,
		Longitude:     body.Longitude,
		Pool:          poolCtx,
		NgoHistory:    history,
	})

	c.JSON(http.StatusCreated, gin.H{
		"proof_id":            proofID,
		"verification_status": "PENDING",
		"message":             "proof received, verification in progress",
	})
}

// ── ML contract types ────────────────────────────────────────────────────────

// poolContext carries the pool fields the ML model needs for geo and cap scoring.
type poolContext struct {
	RegionLat      float64 `json:"region_lat"`
	RegionLng      float64 `json:"region_lng"`
	RegionRadiusKm float64 `json:"region_radius_km"`
	MaxPerClaim    float64 `json:"max_per_claim"`
}

// ngoHistory carries the NGO behavioural signals the ML model uses for fraud detection.
type ngoHistory struct {
	TrustScore           float64 `json:"trust_score"`
	ApprovalRate         float64 `json:"approval_rate"`
	AvgClaimAmount       float64 `json:"avg_claim_amount"`
	SubmissionCountToday int     `json:"submission_count_today"`
	RejectionRate        float64 `json:"rejection_rate"`
}

// MLPayload is the JSON body sent to the Python ML service for every new proof submission.
// Field names match the contract agreed with the Python team exactly.
type MLPayload struct {
	SubmissionID  string     `json:"submission_id"`
	NgoID         string     `json:"ngo_id"`
	OcrAmount     float64    `json:"ocr_amount"`
	ClaimedAmount float64    `json:"claimed_amount"`
	Latitude      float64    `json:"latitude"`
	Longitude     float64    `json:"longitude"`
	Pool          poolContext `json:"pool"`
	NgoHistory    ngoHistory  `json:"ngo_history"`
}

// dispatchToML sends the proof payload to the Python ML service for asynchronous scoring.
//
// The Python service downloads the receipt image, computes fraud signals, and calls back
// via POST /internal/proofs/:id/verify with an MLResult payload.
// Set ML_SERVICE_URL in env (e.g. http://ml-service:5000).
func dispatchToML(payload MLPayload) {
	url := os.Getenv("ML_SERVICE_URL")
	if url == "" {
		fmt.Printf("[ml-dispatch] ML_SERVICE_URL not set, skipping dispatch for proof %s\n", payload.SubmissionID)
		return
	}

	body, err := json.Marshal(payload)
	if err != nil {
		fmt.Printf("[ml-dispatch] marshal error: %v\n", err)
		return
	}

	req, err := http.NewRequest(http.MethodPost, url+"/verify", bytes.NewReader(body))
	if err != nil {
		fmt.Printf("[ml-dispatch] request build error: %v\n", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Secret", os.Getenv("INTERNAL_SECRET"))

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("[ml-dispatch] send error: %v\n", err)
		return
	}
	defer resp.Body.Close()
	fmt.Printf("[ml-dispatch] proof %s dispatched, ml response status: %d\n", payload.SubmissionID, resp.StatusCode)
}

// fetchTrustScore returns the current trust score for an NGO user, defaulting to 0 on error.
func fetchTrustScore(ctx context.Context, db *pgxpool.Pool, ngoID string) float64 {
	var score float64
	_ = db.QueryRow(ctx, `SELECT trust_score FROM users WHERE id = $1`, ngoID).Scan(&score)
	return score
}

// ── query handlers ───────────────────────────────────────────────────────────

// MyProofs returns all proof submissions for the authenticated NGO.
func (h *ProofHandler) MyProofs(c *gin.Context) {
	ngoID := c.GetString("userID")
	rows, err := h.db.Query(context.Background(),
		`SELECT id, pool_id, claimed_amount, verification_status, verification_score,
		        tx_hash, timelock_expires_at, created_at
		 FROM proof_submissions WHERE ngo_id = $1 ORDER BY created_at DESC`,
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
		`SELECT id, ngo_id, claimed_amount, verification_status, verification_score,
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
		`SELECT id, ngo_id, pool_id, receipt_image_url, ocr_amount, ocr_vendor, ocr_date,
		        claimed_amount, latitude, longitude, verification_status, verification_score,
		        release_id, timelock_expires_at, tx_hash, created_at
		 FROM proof_submissions WHERE id = $1`, id)

	var p struct {
		ID                 string     `json:"id"`
		NgoID              string     `json:"ngo_id"`
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
		ReleaseID          *string    `json:"release_id"`
		TimelockExpiresAt  *time.Time `json:"timelock_expires_at"`
		TxHash             *string    `json:"tx_hash"`
		CreatedAt          time.Time  `json:"created_at"`
	}
	if err := row.Scan(
		&p.ID, &p.NgoID, &p.PoolID, &p.ReceiptImageURL,
		&p.OcrAmount, &p.OcrVendor, &p.OcrDate, &p.ClaimedAmount,
		&p.Latitude, &p.Longitude, &p.VerificationStatus, &p.VerificationScore,
		&p.ReleaseID, &p.TimelockExpiresAt, &p.TxHash, &p.CreatedAt,
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
	TimelockExpiresAt  *time.Time `json:"timelock_expires_at"`
	CreatedAt          time.Time  `json:"created_at"`
}

type proofRowPublic struct {
	ID                 string    `json:"id"`
	NgoID              string    `json:"ngo_id"`
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
			&p.TxHash, &p.TimelockExpiresAt, &p.CreatedAt,
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
