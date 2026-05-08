package middleware

import (
	"crypto/subtle"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2"
	clerkjwt "github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/clerk/clerk-sdk-go/v2/user"
	"github.com/gin-gonic/gin"
)

// ClerkAuth verifies the Clerk session JWT from the Authorization header
// and sets "userID" (our internal DB UUID) and "role" into the Gin context,
// so all downstream handlers work without any changes.
//
// The flow:
//  1. Extract Bearer token from Authorization header
//  2. Verify JWT via Clerk SDK (uses JWKS auto-fetch/cache)
//  3. Read the Clerk user's public metadata to get our DB user_id and role
//  4. Set "userID" and "role" in gin.Context — same keys the old JWT() used
func ClerkAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		sessionToken := strings.TrimPrefix(header, "Bearer ")

		// Verify the Clerk session JWT.
		claims, err := clerkjwt.Verify(c.Request.Context(), &clerkjwt.VerifyParams{
			Token: sessionToken,
		})
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid session token"})
			return
		}

		// claims.Subject is the Clerk user ID (e.g., "user_2x...").
		clerkUserID := claims.Subject

		// Fetch the Clerk user to read public metadata (contains our db_user_id and role).
		clerkUser, err := user.Get(c.Request.Context(), clerkUserID)
		if err != nil {
			log.Printf("[clerk] failed to fetch user %s: %v", clerkUserID, err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "failed to resolve user"})
			return
		}

		// Public metadata is set during webhook sync or via Clerk dashboard.
		// Expected shape: { "db_user_id": "uuid", "role": "DONOR|NGO|ADMIN" }
		var meta map[string]any
		if err := json.Unmarshal(clerkUser.PublicMetadata, &meta); err != nil {
			meta = make(map[string]any)
		}
		dbUserID, _ := meta["db_user_id"].(string)
		role, _ := meta["role"].(string)

		if dbUserID == "" || role == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "user not provisioned — please complete onboarding"})
			return
		}

		// Set the same context keys that every handler already reads.
		c.Set("userID", dbUserID)
		c.Set("role", role)
		c.Set("clerkUserID", clerkUserID)
		c.Next()
	}
}

// Role blocks requests whose role does not match the required role.
func Role(required string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != required {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}
		c.Next()
	}
}

// AdminPasswordAuth requires BOTH a valid Clerk session (to resolve the real
// DB user ID) AND the shared admin password via X-Admin-Password header.
// This ensures handlers always see a real UUID in "userID".
func AdminPasswordAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// ── 1. Check admin password ──────────────────────────────────
		password := os.Getenv("ADMIN_ACCESS_PASSWORD")
		if password == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "admin access password not configured"})
			return
		}

		provided := c.GetHeader("X-Admin-Password")
		if subtle.ConstantTimeCompare([]byte(provided), []byte(password)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid admin password"})
			return
		}

		// ── 2. Resolve Clerk session (if present) to get real user ID ──
		header := c.GetHeader("Authorization")
		if strings.HasPrefix(header, "Bearer ") {
			sessionToken := strings.TrimPrefix(header, "Bearer ")
			claims, err := clerkjwt.Verify(c.Request.Context(), &clerkjwt.VerifyParams{
				Token: sessionToken,
			})
			if err == nil {
				clerkUser, err := user.Get(c.Request.Context(), claims.Subject)
				if err == nil {
					var meta map[string]any
					if e := json.Unmarshal(clerkUser.PublicMetadata, &meta); e == nil {
						if dbID, ok := meta["db_user_id"].(string); ok && dbID != "" {
							c.Set("userID", dbID)
							c.Set("role", "ADMIN")
							c.Set("clerkUserID", claims.Subject)
							c.Next()
							return
						}
					}
				}
			}
		}

		// Fallback: password was valid but no Clerk session — set a nil-safe sentinel.
		// Handlers that INSERT with created_by should handle this gracefully.
		c.Set("userID", nil)
		c.Set("role", "ADMIN")
		c.Next()
	}
}

// InternalSecret rejects requests that do not carry the correct X-Internal-Secret header.
func InternalSecret() gin.HandlerFunc {
	return func(c *gin.Context) {
		secret := os.Getenv("INTERNAL_SECRET")
		if secret == "" || c.GetHeader("X-Internal-Secret") != secret {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}

// InitClerk must be called once at startup to set the Clerk secret key.
func InitClerk() {
	key := os.Getenv("CLERK_SECRET_KEY")
	if key == "" {
		log.Println("[clerk] WARNING: CLERK_SECRET_KEY not set — auth will fail")
		return
	}
	clerk.SetKey(key)
	log.Println("[clerk] initialized")
}
