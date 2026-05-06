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
	ngo := api.Group("/ngo")
	{
		h := handlers.NewNGOHandler(pool)
		ngo.POST("/apply", middleware.Role("NGO"), h.Apply)
		ngo.GET("/application/status", middleware.Role("NGO"), h.ApplicationStatus)
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
		admin.POST("/pools/:id/assign-ngo", ph.AssignNGO)
	}

	// ── internal (ML / verification engine webhook) ───────────────────────────
	// Protected by shared secret; called only by the Python verification service
	// and the blockchain worker — never by the Android client.
	internal := r.Group("/internal", middleware.InternalSecret())
	{
		vh := handlers.NewVerificationHandler(pool)
		internal.POST("/proofs/:id/verify", vh.HandleVerificationResult)
		internal.POST("/proofs/:id/release-confirmed", vh.ConfirmRelease)
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
