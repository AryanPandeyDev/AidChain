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

// AssignmentHandler handles NGO pool assignment requests and admin review.
type AssignmentHandler struct {
	db *pgxpool.Pool
	bc *blockchain.Client
}

// NewAssignmentHandler returns an AssignmentHandler backed by the given pool and optional blockchain client.
func NewAssignmentHandler(db *pgxpool.Pool, bc *blockchain.Client) *AssignmentHandler {
	return &AssignmentHandler{db: db, bc: bc}
}

// RequestAssignment submits an NGO's request to be assigned to a crisis pool.
func (h *AssignmentHandler) RequestAssignment(c *gin.Context) {
	ngoID := c.GetString("userID")
	poolID := c.Param("poolId")

	var body struct {
		Justification    string `json:"justification" binding:"required"`
		SupportingDocURL string `json:"supporting_doc_url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var count int
	_ = h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM ngo_applications WHERE ngo_user_id=$1 AND status='VERIFIED'`,
		ngoID,
	).Scan(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "NGO not verified"})
		return
	}

	_ = h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM crisis_pools WHERE id=$1 AND status='ACTIVE'`,
		poolID,
	).Scan(&count)
	if count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "pool not found or not active"})
		return
	}

	_ = h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM pool_assignment_requests WHERE pool_id=$1 AND ngo_user_id=$2 AND status='PENDING'`,
		poolID, ngoID,
	).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "pending request already exists for this pool"})
		return
	}

	var id string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO pool_assignment_requests (pool_id, ngo_user_id, justification, supporting_doc_url)
		 VALUES ($1,$2,$3,$4) RETURNING id`,
		poolID, ngoID, body.Justification, body.SupportingDocURL,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"request_id": id, "status": "PENDING"})
}

// MyAssignmentRequests returns all pool assignment requests submitted by the authenticated NGO.
func (h *AssignmentHandler) MyAssignmentRequests(c *gin.Context) {
	ngoID := c.GetString("userID")

	rows, err := h.db.Query(context.Background(),
		`SELECT r.id, r.pool_id, cp.name AS pool_name, r.status, r.rejection_reason, r.created_at
		 FROM pool_assignment_requests r
		 JOIN crisis_pools cp ON cp.id = r.pool_id
		 WHERE r.ngo_user_id = $1
		 ORDER BY r.created_at DESC`,
		ngoID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type Request struct {
		ID              string    `json:"id"`
		PoolID          string    `json:"pool_id"`
		PoolName        string    `json:"pool_name"`
		Status          string    `json:"status"`
		RejectionReason *string   `json:"rejection_reason"`
		CreatedAt       time.Time `json:"created_at"`
	}
	var requests []Request
	for rows.Next() {
		var req Request
		_ = rows.Scan(&req.ID, &req.PoolID, &req.PoolName, &req.Status, &req.RejectionReason, &req.CreatedAt)
		requests = append(requests, req)
	}

	if requests == nil {
		requests = []Request{}
	}

	c.JSON(http.StatusOK, gin.H{"requests": requests})
}

// ListPoolAssignmentRequests returns all assignment requests for a pool, optionally filtered by status.
func (h *AssignmentHandler) ListPoolAssignmentRequests(c *gin.Context) {
	poolID := c.Param("id")
	status := c.Query("status")

	query := `SELECT r.id, r.ngo_user_id, u.name AS ngo_name, u.trust_score,
		             r.justification, r.supporting_doc_url, r.status, r.created_at
		      FROM pool_assignment_requests r
		      JOIN users u ON u.id = r.ngo_user_id
		      WHERE r.pool_id = $1`
	args := []any{poolID}
	
	if status != "" {
		query += ` AND r.status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY r.created_at ASC`

	rows, err := h.db.Query(context.Background(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	type Request struct {
		ID                 string    `json:"id"`
		NgoUserID          string    `json:"ngo_user_id"`
		NgoName            string    `json:"ngo_name"`
		TrustScore         float64   `json:"trust_score"`
		Justification      string    `json:"justification"`
		SupportingDocURL   *string   `json:"supporting_doc_url"`
		Status             string    `json:"status"`
		CreatedAt          time.Time `json:"created_at"`
	}
	var requests []Request
	for rows.Next() {
		var req Request
		_ = rows.Scan(&req.ID, &req.NgoUserID, &req.NgoName, &req.TrustScore, &req.Justification, &req.SupportingDocURL, &req.Status, &req.CreatedAt)
		requests = append(requests, req)
	}

	if requests == nil {
		requests = []Request{}
	}

	c.JSON(http.StatusOK, gin.H{"requests": requests, "count": len(requests)})
}

// ApproveAssignmentRequest approves an NGO pool assignment request, calls CrisisPool.assignNGO()
// on-chain FIRST, then creates the DB assignment.
func (h *AssignmentHandler) ApproveAssignmentRequest(c *gin.Context) {
	adminID := c.GetString("userID")
	poolID := c.Param("id")
	reqID := c.Param("reqId")

	var ngoUserID string
	err := h.db.QueryRow(context.Background(),
		`SELECT ngo_user_id FROM pool_assignment_requests WHERE id=$1 AND pool_id=$2 AND status='PENDING'`,
		reqID, poolID,
	).Scan(&ngoUserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found or not pending"})
		return
	}

	// On-chain: CrisisPool.assignNGO(ngoWalletAddress) — BEFORE DB commit.
	var chainNote string
	if h.bc != nil {
		var contractAddress, walletAddr string
		_ = h.db.QueryRow(context.Background(),
			`SELECT contract_address FROM crisis_pools WHERE id = $1`, poolID,
		).Scan(&contractAddress)
		_ = h.db.QueryRow(context.Background(),
			`SELECT wallet_address FROM users WHERE id = $1`, ngoUserID,
		).Scan(&walletAddr)

		if contractAddress == "" || walletAddr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing contract_address or wallet — cannot assign on-chain"})
			return
		}

		txHash, err := h.bc.AssignNGO(context.Background(),
			common.HexToAddress(contractAddress), common.HexToAddress(walletAddr))
		if err != nil {
			log.Printf("[blockchain] assignNGO failed for pool %s ngo %s: %v", poolID, ngoUserID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "on-chain assignNGO failed: " + err.Error()})
			return
		}
		chainNote = "on-chain assignNGO tx: " + txHash
	} else {
		chainNote = "blockchain not configured — on-chain assignNGO skipped"
	}

	// Chain succeeded (or not configured) — now update DB.
	tx, err := h.db.Begin(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "tx begin failed"})
		return
	}
	defer tx.Rollback(context.Background())

	_, err = tx.Exec(context.Background(),
		`UPDATE pool_assignment_requests SET status='APPROVED', reviewed_by=$1, reviewed_at=now() WHERE id=$2`,
		adminID, reqID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}

	_, err = tx.Exec(context.Background(),
		`INSERT INTO pool_ngo_assignments (pool_id, ngo_user_id, request_id)
		 VALUES ($1,$2,$3) ON CONFLICT (pool_id, ngo_user_id) DO NOTHING`,
		poolID, ngoUserID, reqID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "insert failed"})
		return
	}

	if err := tx.Commit(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "request approved, NGO assigned to pool",
		"note":    chainNote,
	})
}

// RejectAssignmentRequest rejects an NGO pool assignment request with a required reason.
func (h *AssignmentHandler) RejectAssignmentRequest(c *gin.Context) {
	adminID := c.GetString("userID")
	poolID := c.Param("id")
	reqID := c.Param("reqId")

	var body struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.db.Exec(context.Background(),
		`UPDATE pool_assignment_requests SET status='REJECTED', rejection_reason=$1, reviewed_by=$2, reviewed_at=now()
		 WHERE id=$3 AND pool_id=$4 AND status='PENDING'`,
		body.Reason, adminID, reqID, poolID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	if res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found or not pending"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "request rejected"})
}
