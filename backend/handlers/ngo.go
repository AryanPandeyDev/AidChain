package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"aidchain/blockchain"
)

// NGOHandler handles NGO application submission and admin review.
type NGOHandler struct {
	db *pgxpool.Pool
	bc *blockchain.Client
}

// NewNGOHandler returns an NGOHandler backed by the given connection pool and optional blockchain client.
func NewNGOHandler(db *pgxpool.Pool, bc *blockchain.Client) *NGOHandler {
	return &NGOHandler{db: db, bc: bc}
}

type applyBody struct {
	OrganizationName    string `json:"organization_name"        binding:"required"`
	Country             string `json:"country"                  binding:"required"`
	RegistrationNumber  string `json:"registration_number"      binding:"required"`
	RegistrationDocURL  string `json:"registration_doc_url"     binding:"required,url"`
	TaxIDDocURL         string `json:"tax_id_doc_url"           binding:"required,url"`
	ProofOfOperationURL string `json:"proof_of_operation_url"   binding:"required,url"`
	Website             string `json:"website"`
}

// Apply submits a new NGO application and triggers asynchronous AI pre-screening.
func (h *NGOHandler) Apply(c *gin.Context) {
	userID, _ := c.Get("userID")

	var body applyBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Block a second application while one is still active.
	var count int
	_ = h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM ngo_applications WHERE ngo_user_id = $1 AND status != 'REJECTED'`,
		userID,
	).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "active application already exists"})
		return
	}

	var appID string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO ngo_applications
		   (ngo_user_id, organization_name, country, registration_number,
		    registration_doc_url, tax_id_doc_url, proof_of_operation_url, website, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 RETURNING id`,
		userID, body.OrganizationName, body.Country, body.RegistrationNumber,
		body.RegistrationDocURL, body.TaxIDDocURL, body.ProofOfOperationURL, body.Website, "AI_SCREENING",
	).Scan(&appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "application submission failed"})
		return
	}

	go screenNGOApplication(appID, body, h.db)

	c.JSON(http.StatusCreated, gin.H{"application_id": appID, "status": "AI_SCREENING"})
}

// screenNGOApplication calls the AI screening service and updates the application status with the verdict.
func screenNGOApplication(appID string, body applyBody, db *pgxpool.Pool) {
	fallback := func() {
		_, _ = db.Exec(context.Background(), `UPDATE ngo_applications SET status='PENDING_REVIEW' WHERE id=$1`, appID)
	}

	url := os.Getenv("AI_SCREENING_URL")
	if url == "" {
		log.Printf("[ai-screen] AI_SCREENING_URL not set, skipping screening for application %s", appID)
		fallback()
		return
	}

	payload := map[string]any{
		"application_id":             appID,
		"organization_name":          body.OrganizationName,
		"country":                    body.Country,
		"registration_number":        body.RegistrationNumber,
		"website":                    body.Website,
		"registration_doc_url":       body.RegistrationDocURL,
		"tax_id_doc_url":             body.TaxIDDocURL,
		"proof_of_operation_doc_url": body.ProofOfOperationURL,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[ai-screen] marshal error for application %s: %v", appID, err)
		fallback()
		return
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Post(url+"/screen", "application/json", bytes.NewReader(data))
	if err != nil {
		log.Printf("[ai-screen] request failed for application %s: %v", appID, err)
		fallback()
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[ai-screen] request failed with status %d for application %s", resp.StatusCode, appID)
		fallback()
		return
	}

	var result struct {
		ApplicationID     string  `json:"application_id"`
		AIVerdict         string  `json:"aiVerdict"`
		AIConfidenceScore float64 `json:"aiConfidenceScore"`
		AISummary         string  `json:"aiSummary"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[ai-screen] decode error for application %s: %v", appID, err)
		fallback()
		return
	}

	newStatus := "PENDING_REVIEW"
	if result.AIVerdict == "FAIL" {
		newStatus = "AI_REJECTED"
	}

	_, _ = db.Exec(context.Background(),
		`UPDATE ngo_applications
		 SET status=$1, ai_verdict=$2, ai_confidence_score=$3, ai_summary=$4, ai_screened_at=now()
		 WHERE id=$5`,
		newStatus, result.AIVerdict, result.AIConfidenceScore, result.AISummary, appID,
	)
	log.Printf("[ai-screen] application %s screened: verdict=%s score=%.2f", appID, result.AIVerdict, result.AIConfidenceScore)
}

// ApplicationStatus returns the most recent application status for the authenticated NGO.
func (h *NGOHandler) ApplicationStatus(c *gin.Context) {
	userID, _ := c.Get("userID")
	row := h.db.QueryRow(context.Background(),
		`SELECT id, status, rejection_reason, created_at, reviewed_at
		 FROM ngo_applications WHERE ngo_user_id = $1
		 ORDER BY created_at DESC LIMIT 1`,
		userID,
	)
	var (
		id              string
		status          string
		rejectionReason *string
		createdAt       time.Time
		reviewedAt      *time.Time
	)
	if err := row.Scan(&id, &status, &rejectionReason, &createdAt, &reviewedAt); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no application found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":               id,
		"status":           status,
		"rejection_reason": rejectionReason,
		"created_at":       createdAt,
		"reviewed_at":      reviewedAt,
	})
}

// ListApplications returns all NGO applications ordered by submission time, optionally filtered by status.
func (h *NGOHandler) ListApplications(c *gin.Context) {
	status := c.Query("status")

	query := `SELECT id, ngo_user_id, organization_name, country, status, created_at
			  FROM ngo_applications`
	args := []any{}

	if status == "" {
		status = "PENDING_REVIEW"
	}
	query += ` WHERE status = $1`
	args = append(args, status)
	
	query += ` ORDER BY created_at ASC`

	rows, err := h.db.Query(context.Background(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type App struct {
		ID               string    `json:"id"`
		NgoUserID        string    `json:"ngo_user_id"`
		OrganizationName string    `json:"organization_name"`
		Country          string    `json:"country"`
		Status           string    `json:"status"`
		CreatedAt        time.Time `json:"created_at"`
	}
	var result []App
	for rows.Next() {
		var a App
		if err := rows.Scan(&a.ID, &a.NgoUserID, &a.OrganizationName, &a.Country, &a.Status, &a.CreatedAt); err != nil {
			continue
		}
		result = append(result, a)
	}
	c.JSON(http.StatusOK, gin.H{"applications": result, "count": len(result)})
}

// GetApplication returns a single NGO application with all document URLs and review metadata.
func (h *NGOHandler) GetApplication(c *gin.Context) {
	id := c.Param("id")
	row := h.db.QueryRow(context.Background(),
		`SELECT id, ngo_user_id, organization_name, country, registration_number,
		        registration_doc_url, tax_id_doc_url, proof_of_operation_url,
		        website, status, rejection_reason, reviewed_by, reviewed_at, created_at
		 FROM ngo_applications WHERE id = $1`, id)

	var app struct {
		ID                     string     `json:"id"`
		NgoUserID              string     `json:"ngo_user_id"`
		OrganizationName       string     `json:"organization_name"`
		Country                string     `json:"country"`
		RegistrationNumber     string     `json:"registration_number"`
		RegistrationDocURL     string     `json:"registration_doc_url"`
		TaxIDDocURL            string     `json:"tax_id_doc_url"`
		ProofOfOperationURL    string     `json:"proof_of_operation_url"`
		Website                *string    `json:"website"`
		Status                 string     `json:"status"`
		RejectionReason        *string    `json:"rejection_reason"`
		ReviewedBy             *string    `json:"reviewed_by"`
		ReviewedAt             *time.Time `json:"reviewed_at"`
		CreatedAt              time.Time  `json:"created_at"`
	}
	if err := row.Scan(
		&app.ID, &app.NgoUserID, &app.OrganizationName, &app.Country,
		&app.RegistrationNumber, &app.RegistrationDocURL, &app.TaxIDDocURL,
		&app.ProofOfOperationURL, &app.Website, &app.Status,
		&app.RejectionReason, &app.ReviewedBy, &app.ReviewedAt, &app.CreatedAt,
	); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
		return
	}
	c.JSON(http.StatusOK, app)
}

// Approve approves a pending NGO application, sets the initial trust score to 50,
// and calls PoolFactory.addVerifiedNGO on-chain.
func (h *NGOHandler) Approve(c *gin.Context) {
	appID := c.Param("id")
	adminID, _ := c.Get("userID")
	now := time.Now()

	var ngoUserID string
	if err := h.db.QueryRow(context.Background(),
		`SELECT ngo_user_id FROM ngo_applications WHERE id = $1 AND status = 'PENDING_REVIEW'`,
		appID,
	).Scan(&ngoUserID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found or not pending"})
		return
	}

	tx, err := h.db.Begin(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tx begin failed"})
		return
	}
	defer tx.Rollback(context.Background())

	_, err = tx.Exec(context.Background(),
		`UPDATE ngo_applications SET status='VERIFIED', reviewed_by=$1, reviewed_at=$2 WHERE id=$3`,
		adminID, now, appID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}

	// PRD: new NGOs start at 50/100 upon verification approval.
	_, err = tx.Exec(context.Background(),
		`UPDATE users SET trust_score = 50 WHERE id = $1`,
		ngoUserID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "trust score init failed"})
		return
	}

	_, err = tx.Exec(context.Background(),
		`INSERT INTO trust_score_logs (ngo_user_id, previous_score, new_score, reason)
		 VALUES ($1, 0, 50, 'NGO application approved — initial score set')`,
		ngoUserID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "trust log insert failed"})
		return
	}

	if err := tx.Commit(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	// On-chain: PoolFactory.addVerifiedNGO(ngoWalletAddress)
	var chainNote string
	if h.bc != nil {
		var walletAddr string
		_ = h.db.QueryRow(context.Background(),
			`SELECT wallet_address FROM users WHERE id = $1`, ngoUserID,
		).Scan(&walletAddr)

		if walletAddr != "" {
			txHash, err := h.bc.AddVerifiedNGO(context.Background(), common.HexToAddress(walletAddr))
			if err != nil {
				log.Printf("[blockchain] addVerifiedNGO failed for %s: %v", walletAddr, err)
				chainNote = "on-chain whitelist failed: " + err.Error()
			} else {
				chainNote = "on-chain whitelist tx: " + txHash
			}
		} else {
			chainNote = "NGO has no wallet connected — on-chain whitelist skipped"
		}
	} else {
		chainNote = "blockchain not configured — on-chain whitelist skipped"
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "NGO approved",
		"ngo_user_id": ngoUserID,
		"note":        chainNote,
	})
}

// Reject rejects a pending NGO application and records the admin-supplied reason.
func (h *NGOHandler) Reject(c *gin.Context) {
	appID := c.Param("id")
	adminID, _ := c.Get("userID")

	var body struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.db.Exec(context.Background(),
		`UPDATE ngo_applications
		 SET status='REJECTED', rejection_reason=$1, reviewed_by=$2, reviewed_at=now()
		 WHERE id=$3 AND status='PENDING_REVIEW'`,
		body.Reason, adminID, appID,
	)
	if err != nil || res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found or not pending"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "NGO rejected"})
}

// Dashboard returns the authenticated NGO's assigned pools, trust score, and recent proof submissions.
func (h *NGOHandler) Dashboard(c *gin.Context) {
	ngoID := c.GetString("userID")

	var status string
	err := h.db.QueryRow(context.Background(),
		`SELECT status FROM ngo_applications WHERE ngo_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
		ngoID,
	).Scan(&status)
	if err != nil || status != "VERIFIED" {
		c.JSON(http.StatusForbidden, gin.H{"error": "NGO not verified"})
		return
	}

	var trustScore float64
	var flagged bool
	_ = h.db.QueryRow(context.Background(),
		`SELECT trust_score, flagged FROM users WHERE id = $1`,
		ngoID,
	).Scan(&trustScore, &flagged)

	type Pool struct {
		ID              string  `json:"id"`
		Name            string  `json:"name"`
		Region          string  `json:"region"`
		ContractAddress string  `json:"contract_address"`
		MaxPerClaim     float64 `json:"max_per_claim"`
		Status          string  `json:"status"`
	}
	var pools []Pool
	poolRows, _ := h.db.Query(context.Background(),
		`SELECT cp.id, cp.name, cp.region, cp.contract_address, cp.max_per_claim, cp.status
		 FROM pool_ngo_assignments pna
		 JOIN crisis_pools cp ON cp.id = pna.pool_id
		 WHERE pna.ngo_user_id = $1
		 ORDER BY pna.assigned_at DESC`,
		ngoID,
	)
	defer poolRows.Close()
	for poolRows.Next() {
		var p Pool
		_ = poolRows.Scan(&p.ID, &p.Name, &p.Region, &p.ContractAddress, &p.MaxPerClaim, &p.Status)
		pools = append(pools, p)
	}

	type Proof struct {
		ID                 string    `json:"id"`
		PoolID             string    `json:"pool_id"`
		ClaimedAmount      float64   `json:"claimed_amount"`
		VerificationStatus string    `json:"verification_status"`
		VerificationScore  *float64  `json:"verification_score"`
		CreatedAt          time.Time `json:"created_at"`
	}
	var proofs []Proof
	proofRows, _ := h.db.Query(context.Background(),
		`SELECT id, pool_id, claimed_amount, verification_status, verification_score, created_at
		 FROM proof_submissions
		 WHERE ngo_user_id = $1
		 ORDER BY created_at DESC LIMIT 10`,
		ngoID,
	)
	defer proofRows.Close()
	for proofRows.Next() {
		var p Proof
		_ = proofRows.Scan(&p.ID, &p.PoolID, &p.ClaimedAmount, &p.VerificationStatus, &p.VerificationScore, &p.CreatedAt)
		proofs = append(proofs, p)
	}

	// In case loops yield nil, return empty arrays so JSON is [] not null
	if pools == nil {
		pools = []Pool{}
	}
	if proofs == nil {
		proofs = []Proof{}
	}

	c.JSON(http.StatusOK, gin.H{
		"trust_score":    trustScore,
		"flagged":        flagged,
		"assigned_pools": pools,
		"recent_proofs":  proofs,
	})
}
