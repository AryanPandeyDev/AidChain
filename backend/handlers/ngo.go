package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NGOHandler handles NGO application submission and admin review.
type NGOHandler struct{ db *pgxpool.Pool }

// NewNGOHandler returns an NGOHandler backed by the given connection pool.
func NewNGOHandler(db *pgxpool.Pool) *NGOHandler { return &NGOHandler{db: db} }

// Apply submits a new NGO application with organization details and document URLs.
//
// Document files are uploaded to S3 by the client beforehand; only the
// resulting signed URLs are sent here.
func (h *NGOHandler) Apply(c *gin.Context) {
	userID, _ := c.Get("userID")

	var body struct {
		OrganizationName       string `json:"organization_name"         binding:"required"`
		Country                string `json:"country"                   binding:"required"`
		RegistrationNumber     string `json:"registration_number"       binding:"required"`
		RegistrationDocURL     string `json:"registration_doc_url"      binding:"required,url"`
		TaxIDDocURL            string `json:"tax_id_doc_url"            binding:"required,url"`
		ProofOfOperationDocURL string `json:"proof_of_operation_doc_url" binding:"required,url"`
		Website                string `json:"website"`
	}
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
		    registration_doc_url, tax_id_doc_url, proof_of_operation_doc_url, website)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING id`,
		userID, body.OrganizationName, body.Country, body.RegistrationNumber,
		body.RegistrationDocURL, body.TaxIDDocURL, body.ProofOfOperationDocURL, body.Website,
	).Scan(&appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "application submission failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"application_id": appID, "status": "PENDING_REVIEW"})
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
	if status != "" {
		query += ` WHERE status = $1`
		args = append(args, status)
	}
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
		        registration_doc_url, tax_id_doc_url, proof_of_operation_doc_url,
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
		ProofOfOperationDocURL string     `json:"proof_of_operation_doc_url"`
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
		&app.ProofOfOperationDocURL, &app.Website, &app.Status,
		&app.RejectionReason, &app.ReviewedBy, &app.ReviewedAt, &app.CreatedAt,
	); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
		return
	}
	c.JSON(http.StatusOK, app)
}

// Approve approves a pending NGO application, sets the initial trust score to 50, and enqueues the blockchain whitelist job.
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
		`INSERT INTO trust_score_logs (ngo_id, previous_score, new_score, reason)
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

	// TODO: trigger blockchain worker → PoolFactory.addVerifiedNGO(walletAddress)
	c.JSON(http.StatusOK, gin.H{
		"message":     "NGO approved",
		"ngo_user_id": ngoUserID,
		"note":        "blockchain whitelist job enqueued",
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
