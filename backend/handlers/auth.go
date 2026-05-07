package handlers

import (
	"context"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"aidchain/middleware"
)

// AuthHandler handles user registration and login.
type AuthHandler struct{ db *pgxpool.Pool }

// NewAuthHandler returns an AuthHandler backed by the given connection pool.
func NewAuthHandler(db *pgxpool.Pool) *AuthHandler { return &AuthHandler{db: db} }

// Register creates a new DONOR or NGO account and returns a signed JWT.
func (h *AuthHandler) Register(c *gin.Context) {
	var body struct {
		Email    string `json:"email"    binding:"required,email"`
		Password string `json:"password" binding:"required,min=8"`
		Name     string `json:"name"     binding:"required"`
		Role     string `json:"role"     binding:"required,oneof=DONOR NGO ADMIN"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	var userID string
	err = h.db.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, name, role)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		strings.ToLower(body.Email), string(hash), body.Name, body.Role,
	).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "registration failed"})
		return
	}

	token, err := middleware.IssueToken(userID, body.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token issue failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"token": token, "user_id": userID, "role": body.Role, "name": body.Name})
}

// Login authenticates a user by email and password and returns a signed JWT.
func (h *AuthHandler) Login(c *gin.Context) {
	var body struct {
		Email    string `json:"email"    binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var (
		userID       string
		role         string
		passwordHash string
		createdAt    time.Time
	)
	err := h.db.QueryRow(context.Background(),
		`SELECT id, role, password_hash, created_at FROM users WHERE email = $1`,
		strings.ToLower(body.Email),
	).Scan(&userID, &role, &passwordHash, &createdAt)
	if err != nil {
		// Return a generic message to avoid email enumeration.
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := middleware.IssueToken(userID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token issue failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user_id": userID, "role": role})
}

// ConnectWallet verifies an EIP-191 wallet ownership signature and saves the wallet address to the user record.
func (h *AuthHandler) ConnectWallet(c *gin.Context) {
	userID := c.GetString("userID")

	var body struct {
		WalletAddress string `json:"wallet_address" binding:"required,startswith=0x,len=42"`
		Signature     string `json:"signature"      binding:"required"`
		Nonce         string `json:"nonce"          binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	message := fmt.Sprintf("AidChain Wallet Verification\nNonce: %s", body.Nonce)

	// EIP-191 prefixed hash matches what MetaMask and WalletConnect produce.
	hash := accounts.TextHash([]byte(message))

	sigBytes, err := hex.DecodeString(strings.TrimPrefix(body.Signature, "0x"))
	if err != nil || len(sigBytes) != 65 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature length"})
		return
	}

	// Normalize Ethereum legacy recovery IDs (27/28) to standard (0/1).
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}

	pubKey, err := crypto.SigToPub(hash, sigBytes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "signature recovery failed"})
		return
	}

	recovered := crypto.PubkeyToAddress(*pubKey).Hex()

	if !strings.EqualFold(recovered, body.WalletAddress) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "signature does not match wallet address"})
		return
	}

	_, err = h.db.Exec(context.Background(),
		`UPDATE users SET wallet_address = $1 WHERE id = $2`,
		body.WalletAddress, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "wallet save failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "wallet connected", "wallet_address": body.WalletAddress})
}
