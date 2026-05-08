package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/user"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuthHandler handles wallet connection and Clerk webhook sync.
type AuthHandler struct{ db *pgxpool.Pool }

// NewAuthHandler returns an AuthHandler backed by the given connection pool.
func NewAuthHandler(db *pgxpool.Pool) *AuthHandler { return &AuthHandler{db: db} }

// Me returns the authenticated user's profile from the database.
// This is the frontend's source of truth for role, wallet, trust score, etc.
func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.GetString("userID")

	var (
		id            string
		email         string
		name          string
		role          string
		walletAddress *string
		trustScore    float64
		flagged       bool
	)
	err := h.db.QueryRow(context.Background(),
		`SELECT id, email, name, role, wallet_address, trust_score, flagged FROM users WHERE id = $1`,
		userID,
	).Scan(&id, &email, &name, &role, &walletAddress, &trustScore, &flagged)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":             id,
		"email":          email,
		"name":           name,
		"role":           role,
		"wallet_address": walletAddress,
		"trust_score":    trustScore,
		"flagged":        flagged,
	})
}

// WalletNonce returns a short-lived, server-signed nonce for wallet ownership proof.
func (h *AuthHandler) WalletNonce(c *gin.Context) {
	userID := c.GetString("userID")

	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "nonce generation failed"})
		return
	}

	expiresAt := time.Now().Add(5 * time.Minute).Unix()
	randomPart := hex.EncodeToString(nonceBytes)
	payload := fmt.Sprintf("%s.%d.%s", userID, expiresAt, randomPart)
	sig := signWalletNonce(payload)
	nonce := base64.RawURLEncoding.EncodeToString([]byte(payload + "." + sig))

	c.JSON(http.StatusOK, gin.H{
		"nonce":     nonce,
		"message":   fmt.Sprintf("AidChain Wallet Verification\nNonce: %s", nonce),
		"expiresAt": expiresAt,
	})
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

	if err := verifyWalletNonce(userID, body.Nonce); err != nil {
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

func signWalletNonce(payload string) string {
	mac := hmac.New(sha256.New, []byte(walletNonceSecret()))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func verifyWalletNonce(userID, nonce string) error {
	raw, err := base64.RawURLEncoding.DecodeString(nonce)
	if err != nil {
		return fmt.Errorf("invalid wallet nonce")
	}

	parts := strings.Split(string(raw), ".")
	if len(parts) != 4 {
		return fmt.Errorf("invalid wallet nonce")
	}
	if parts[0] != userID {
		return fmt.Errorf("wallet nonce does not belong to current user")
	}

	var expiresAt int64
	if _, err := fmt.Sscanf(parts[1], "%d", &expiresAt); err != nil {
		return fmt.Errorf("invalid wallet nonce expiry")
	}
	if time.Now().Unix() > expiresAt {
		return fmt.Errorf("wallet nonce expired")
	}

	payload := strings.Join(parts[:3], ".")
	if !hmac.Equal([]byte(parts[3]), []byte(signWalletNonce(payload))) {
		return fmt.Errorf("invalid wallet nonce signature")
	}

	return nil
}

func walletNonceSecret() string {
	for _, key := range []string{"JWT_SECRET", "INTERNAL_SECRET", "CLERK_WEBHOOK_SECRET"} {
		if v := os.Getenv(key); v != "" {
			return v
		}
	}
	return "aidchain-dev-wallet-nonce-secret"
}

// ─── Clerk Webhook ──────────────────────────────────────────────────────────

// ClerkWebhook handles Clerk's user.created and user.updated webhook events.
// It syncs the Clerk user to our local DB and writes back the db_user_id + role
// into Clerk's public metadata so the auth middleware can map sessions to DB users.
//
// Required env vars:
//
//	CLERK_WEBHOOK_SECRET — the Svix signing secret from Clerk Dashboard → Webhooks
func (h *AuthHandler) ClerkWebhook(c *gin.Context) {
	webhookSecret := os.Getenv("CLERK_WEBHOOK_SECRET")
	if webhookSecret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "webhook secret not configured"})
		return
	}

	// Read the raw body for signature verification.
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	// Verify the Svix webhook signature.
	if err := verifySvixSignature(body, c.Request.Header, webhookSecret); err != nil {
		log.Printf("[clerk-webhook] signature verification failed: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature"})
		return
	}

	// Parse the event envelope.
	var event struct {
		Type string          `json:"type"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid event payload"})
		return
	}

	switch event.Type {
	case "user.created", "user.updated":
		h.handleUserSync(c, event.Data)
	default:
		// Acknowledge unknown events without error.
		c.JSON(http.StatusOK, gin.H{"status": "ignored", "type": event.Type})
	}
}

// verifySvixSignature verifies Clerk's Svix webhook signature using HMAC-SHA256.
// Clerk uses the standard Svix signing scheme:
//
//	signed_content = "${svix_id}.${svix_timestamp}.${body}"
//	signature = base64(hmac_sha256(secret, signed_content))
func verifySvixSignature(body []byte, headers http.Header, secret string) error {
	svixID := headers.Get("svix-id")
	svixTimestamp := headers.Get("svix-timestamp")
	svixSignature := headers.Get("svix-signature")

	if svixID == "" || svixTimestamp == "" || svixSignature == "" {
		return fmt.Errorf("missing svix headers")
	}

	// Reject timestamps older than 5 minutes to prevent replay attacks.
	var ts int64
	if _, err := fmt.Sscanf(svixTimestamp, "%d", &ts); err != nil {
		return fmt.Errorf("invalid timestamp")
	}
	if math.Abs(float64(time.Now().Unix()-ts)) > 300 {
		return fmt.Errorf("timestamp too old")
	}

	// Decode the secret (strip "whsec_" prefix, then base64 decode).
	secretBytes, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(secret, "whsec_"))
	if err != nil {
		return fmt.Errorf("invalid secret: %w", err)
	}

	// Sign: "${svix_id}.${svix_timestamp}.${body}"
	signedContent := fmt.Sprintf("%s.%s.%s", svixID, svixTimestamp, string(body))
	mac := hmac.New(sha256.New, secretBytes)
	mac.Write([]byte(signedContent))
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	// The header may contain multiple signatures separated by spaces (e.g., "v1,sig1 v1,sig2").
	for _, sig := range strings.Split(svixSignature, " ") {
		parts := strings.SplitN(sig, ",", 2)
		if len(parts) == 2 && parts[0] == "v1" && hmac.Equal([]byte(parts[1]), []byte(expected)) {
			return nil
		}
	}
	return fmt.Errorf("no matching signature")
}

// handleUserSync creates or updates a local DB user from Clerk event data,
// then writes the db_user_id and role back to Clerk's public metadata.
func (h *AuthHandler) handleUserSync(c *gin.Context, data json.RawMessage) {
	var clerkUser struct {
		ID             string `json:"id"`
		EmailAddresses []struct {
			EmailAddress string `json:"email_address"`
		} `json:"email_addresses"`
		FirstName      *string        `json:"first_name"`
		LastName       *string        `json:"last_name"`
		PublicMetadata map[string]any `json:"public_metadata"`
		UnsafeMetadata map[string]any `json:"unsafe_metadata"`
	}
	if err := json.Unmarshal(data, &clerkUser); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user data"})
		return
	}

	if len(clerkUser.EmailAddresses) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user has no email"})
		return
	}
	email := strings.ToLower(clerkUser.EmailAddresses[0].EmailAddress)

	// Build the display name from Clerk fields.
	name := "User"
	if clerkUser.FirstName != nil {
		name = *clerkUser.FirstName
		if clerkUser.LastName != nil {
			name += " " + *clerkUser.LastName
		}
	}

	// Determine the role. Priority:
	//   1. public_metadata.role (set by admin in Clerk dashboard)
	//   2. unsafe_metadata.role (set by frontend during signup)
	//   3. default to "DONOR"
	role := "DONOR"
	if r, ok := clerkUser.PublicMetadata["role"].(string); ok && r != "" {
		role = r
	} else if r, ok := clerkUser.UnsafeMetadata["role"].(string); ok && r != "" {
		role = r
	}

	// Validate role.
	switch role {
	case "DONOR", "NGO", "ADMIN":
		// ok
	default:
		role = "DONOR"
	}

	// Upsert user — if clerk_id already exists, update; otherwise insert.
	var dbUserID string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO users (clerk_id, email, name, role)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (clerk_id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name
		 RETURNING id`,
		clerkUser.ID, email, name, role,
	).Scan(&dbUserID)
	if err != nil {
		log.Printf("[clerk-webhook] user upsert failed for %s: %v", clerkUser.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user sync failed"})
		return
	}

	// Write db_user_id and role back to Clerk's public metadata
	// so the auth middleware can read it without hitting the DB.
	existingMeta := clerkUser.PublicMetadata
	if existingMeta == nil {
		existingMeta = make(map[string]any)
	}
	needsUpdate := existingMeta["db_user_id"] != dbUserID || existingMeta["role"] != role
	if needsUpdate {
		existingMeta["db_user_id"] = dbUserID
		existingMeta["role"] = role
		metaJSON, _ := json.Marshal(existingMeta)
		_, err = user.Update(context.Background(), clerkUser.ID, &user.UpdateParams{
			PublicMetadata: clerk.JSONRawMessage(metaJSON),
		})
		if err != nil {
			log.Printf("[clerk-webhook] failed to update public metadata for %s: %v", clerkUser.ID, err)
			// Non-fatal — user is synced to DB, metadata update can be retried.
		}
	}

	log.Printf("[clerk-webhook] synced user %s → db_user_id=%s role=%s", clerkUser.ID, dbUserID, role)
	c.JSON(http.StatusOK, gin.H{"status": "synced", "db_user_id": dbUserID, "role": role})
}

// DevProvision is a development-only handler that manually syncs a Clerk user
// to the local database without requiring a Svix webhook signature.
//
// POST /api/dev/provision
//
//	{ "clerk_user_id": "user_2x...", "role": "DONOR|NGO|ADMIN" }
func (h *AuthHandler) DevProvision(c *gin.Context) {
	var body struct {
		ClerkUserID string `json:"clerk_user_id" binding:"required"`
		Role        string `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Only DONOR and NGO can self-assign. ADMIN must be set manually via
	// the CLI: go run ./cmd/makeadmin <email>
	role := body.Role
	switch role {
	case "DONOR", "NGO":
	case "ADMIN":
		c.JSON(http.StatusForbidden, gin.H{"error": "admin role cannot be self-assigned"})
		return
	default:
		role = "DONOR"
	}

	// Fetch the real Clerk user to get their email and name.
	clerkUser, err := user.Get(c.Request.Context(), body.ClerkUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "clerk user not found: " + err.Error()})
		return
	}

	email := ""
	for _, e := range clerkUser.EmailAddresses {
		if e.EmailAddress != "" {
			email = strings.ToLower(e.EmailAddress)
			break
		}
	}
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "clerk user has no email"})
		return
	}

	name := "User"
	if clerkUser.FirstName != nil && *clerkUser.FirstName != "" {
		name = *clerkUser.FirstName
		if clerkUser.LastName != nil {
			name += " " + *clerkUser.LastName
		}
	}

	// Upsert in DB.
	// On conflict: always update email/name, and upgrade role DONOR→NGO if requested.
	// Never overwrite ADMIN (admins are set via CLI only).
	var dbUserID, actualRole string
	err = h.db.QueryRow(context.Background(),
		`INSERT INTO users (clerk_id, email, name, role)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (clerk_id) DO UPDATE
		   SET email = EXCLUDED.email,
		       name  = EXCLUDED.name,
		       role  = CASE
		                 WHEN users.role = 'ADMIN' THEN users.role
		                 WHEN users.role = 'NGO'   THEN users.role
		                 ELSE EXCLUDED.role
		               END
		 RETURNING id, role`,
		body.ClerkUserID, email, name, role,
	).Scan(&dbUserID, &actualRole)
	if err != nil {
		log.Printf("[dev-provision] upsert failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db upsert failed: " + err.Error()})
		return
	}

	// Write db_user_id + actual role back to Clerk public metadata.
	meta := map[string]any{"db_user_id": dbUserID, "role": actualRole}
	metaJSON, _ := json.Marshal(meta)
	if _, err = user.Update(c.Request.Context(), body.ClerkUserID, &user.UpdateParams{
		PublicMetadata: clerk.JSONRawMessage(metaJSON),
	}); err != nil {
		log.Printf("[dev-provision] metadata update failed: %v", err)
		// Non-fatal — DB is updated; metadata can be retried.
	}

	log.Printf("[dev-provision] provisioned %s → db_user_id=%s role=%s", body.ClerkUserID, dbUserID, actualRole)
	c.JSON(http.StatusOK, gin.H{"status": "provisioned", "db_user_id": dbUserID, "role": actualRole, "email": email})
}
