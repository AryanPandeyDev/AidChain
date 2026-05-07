package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"aidchain/blockchain"
	"aidchain/db"
	"aidchain/handlers"
	"aidchain/middleware"
)

func main() {
	_ = godotenv.Load()

	// Initialize Clerk before anything else.
	middleware.InitClerk()

	pool, err := db.Connect(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	// Blockchain client — returns nil if POLYGON_RPC_URL is not set.
	bc, err := blockchain.New()
	if err != nil {
		log.Printf("[blockchain] init warning: %v — blockchain features disabled", err)
		bc = nil
	}

	// Start the event listener in a background goroutine.
	blockchain.StartEventListener(context.Background(), bc, pool)

	r := gin.Default()

	// CORS — allow frontend dev server and production origins.
	r.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Internal-Secret")
		c.Header("Access-Control-Allow-Credentials", "true")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// ── public routes ─────────────────────────────────────────────────────────

	// Clerk webhook — receives user.created / user.updated events.
	// Must be public (Clerk calls it directly, authenticated via Svix signature).
	webhookH := handlers.NewAuthHandler(pool)
	r.POST("/api/webhooks/clerk", webhookH.ClerkWebhook)

	// Public pool listing (no auth required per PRD §4.3).
	poolH := handlers.NewPoolHandler(pool, bc)
	r.GET("/api/pools", poolH.ListPools)
	r.GET("/api/pools/:id", poolH.GetPool)

	// ── authenticated routes (Clerk session JWT) ──────────────────────────────
	api := r.Group("/api", middleware.ClerkAuth())

	// connect wallet (requires auth)
	ah := handlers.NewAuthHandler(pool)
	api.POST("/auth/connect-wallet", ah.ConnectWallet)

	// donations (read-only endpoints — recording is done via event listener)
	donations := api.Group("/donations")
	{
		h := handlers.NewDonationHandler(pool)
		donations.GET("/my", h.MyDonations)
		donations.GET("/pool/:poolId", h.PoolDonations)
	}

	// proofs
	proofs := api.Group("/proofs")
	{
		h := handlers.NewProofHandler(pool, bc)
		proofs.POST("", middleware.Role("NGO"), h.SubmitProof)
		proofs.GET("/my", middleware.Role("NGO"), h.MyProofs)
		proofs.GET("/pool/:poolId", h.PoolProofs)
		proofs.GET("/:id", h.GetProof)
	}

	// trust scores
	trust := api.Group("/trust")
	{
		h := handlers.NewTrustHandler(pool)
		trust.GET("/my", middleware.Role("NGO"), h.MyTrust)
		trust.GET("/ngo/:ngoId", h.NgoTrust)
	}

	// NGO self-service
	assignH := handlers.NewAssignmentHandler(pool, bc)
	ngo := api.Group("/ngo")
	{
		h := handlers.NewNGOHandler(pool, bc)
		ngo.POST("/apply", middleware.Role("NGO"), h.Apply)
		ngo.GET("/application/status", middleware.Role("NGO"), h.ApplicationStatus)
		ngo.GET("/dashboard", middleware.Role("NGO"), h.Dashboard)

		ngo.POST("/pools/:poolId/request-assignment", middleware.Role("NGO"), assignH.RequestAssignment)
		ngo.GET("/assignment-requests", middleware.Role("NGO"), assignH.MyAssignmentRequests)
	}

	// ── admin routes ──────────────────────────────────────────────────────────
	admin := api.Group("/admin", middleware.Role("ADMIN"))
	{
		nh := handlers.NewNGOHandler(pool, bc)
		admin.GET("/ngo/applications", nh.ListApplications)
		admin.GET("/ngo/applications/:id", nh.GetApplication)
		admin.POST("/ngo/applications/:id/approve", nh.Approve)
		admin.POST("/ngo/applications/:id/reject", nh.Reject)

		admin.POST("/pools", poolH.CreatePool)
		admin.POST("/pools/:id/pause", poolH.PausePool)
		admin.POST("/pools/:id/resume", poolH.ResumePool)

		admin.GET("/pools/:id/assignment-requests", assignH.ListPoolAssignmentRequests)
		admin.POST("/pools/:id/assignment-requests/:reqId/approve", assignH.ApproveAssignmentRequest)
		admin.POST("/pools/:id/assignment-requests/:reqId/reject", assignH.RejectAssignmentRequest)
	}

	addr := ":" + getEnv("PORT", "8080")
	log.Printf("AidChain API listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// getEnv returns the value of key or fallback when the variable is unset or empty.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
