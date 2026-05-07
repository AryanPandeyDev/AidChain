package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"aidchain/db"
	"aidchain/handlers"
	"aidchain/middleware"
)

func main() {
	_ = godotenv.Load()

	pool, err := db.Connect(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	r := gin.Default()

	// ── public routes ─────────────────────────────────────────────────────────
	auth := r.Group("/api/auth")
	{
		h := handlers.NewAuthHandler(pool)
		auth.POST("/register", h.Register)
		auth.POST("/login", h.Login)
	}

	// ── authenticated routes ──────────────────────────────────────────────────
	api := r.Group("/api", middleware.JWT())

	// connect wallet (requires JWT)
	ah := handlers.NewAuthHandler(pool)
	api.POST("/auth/connect-wallet", ah.ConnectWallet)

	// pools (public read after auth)
	pools := api.Group("/pools")
	{
		h := handlers.NewPoolHandler(pool)
		pools.GET("", h.ListPools)
		pools.GET("/:id", h.GetPool)
	}

	// donations
	donations := api.Group("/donations")
	{
		h := handlers.NewDonationHandler(pool)
		donations.POST("", h.RecordDonation)
		donations.GET("/my", h.MyDonations)
		donations.GET("/pool/:poolId", h.PoolDonations)
	}

	// proofs (NGO only writes)
	proofs := api.Group("/proofs")
	{
		h := handlers.NewProofHandler(pool)
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
	assignH := handlers.NewAssignmentHandler(pool)
	ngo := api.Group("/ngo")
	{
		h := handlers.NewNGOHandler(pool)
		ngo.POST("/apply", middleware.Role("NGO"), h.Apply)
		ngo.GET("/application/status", middleware.Role("NGO"), h.ApplicationStatus)
		ngo.GET("/dashboard", middleware.Role("NGO"), h.Dashboard)

		ngo.POST("/pools/:poolId/request-assignment", middleware.Role("NGO"), assignH.RequestAssignment)
		ngo.GET("/assignment-requests", middleware.Role("NGO"), assignH.MyAssignmentRequests)
	}

	// ── admin routes ──────────────────────────────────────────────────────────
	admin := api.Group("/admin", middleware.Role("ADMIN"))
	{
		nh := handlers.NewNGOHandler(pool)
		admin.GET("/ngo/applications", nh.ListApplications)
		admin.GET("/ngo/applications/:id", nh.GetApplication)
		admin.POST("/ngo/applications/:id/approve", nh.Approve)
		admin.POST("/ngo/applications/:id/reject", nh.Reject)

		ph := handlers.NewPoolHandler(pool)
		admin.POST("/pools", ph.CreatePool)
		admin.POST("/pools/:id/pause", ph.PausePool)
		admin.POST("/pools/:id/resume", ph.ResumePool)

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
