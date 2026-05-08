package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatal("connect:", err)
	}
	defer pool.Close()

	queries := []string{
		`TRUNCATE TABLE trust_score_logs CASCADE`,
		`TRUNCATE TABLE proof_submissions CASCADE`,
		`TRUNCATE TABLE donations CASCADE`,
		`TRUNCATE TABLE pool_ngo_assignments CASCADE`,
		`TRUNCATE TABLE pool_assignment_requests CASCADE`,
		`TRUNCATE TABLE crisis_pools CASCADE`,
		`TRUNCATE TABLE ngo_applications CASCADE`,
		`TRUNCATE TABLE event_sync_cursor CASCADE`,
		`TRUNCATE TABLE users CASCADE`,
		`INSERT INTO event_sync_cursor (last_block) VALUES (0)`,
	}

	for _, q := range queries {
		if _, err := pool.Exec(context.Background(), q); err != nil {
			log.Fatalf("failed: %s → %v", q, err)
		}
		fmt.Println("OK:", q)
	}

	fmt.Println("\n✅ Database reset complete. All tables are empty.")
	fmt.Println("   Your user will be re-created on next sign-in via the Clerk webhook.")
}
