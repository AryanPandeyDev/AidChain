package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	conn, err := pgx.Connect(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer conn.Close(context.Background())

	migrations := []string{
		`ALTER TABLE ngo_applications ADD COLUMN IF NOT EXISTS ai_evidence JSONB`,
		`DO $$ BEGIN ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
		`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id)`,
	}

	for i, sql := range migrations {
		_, err := conn.Exec(context.Background(), sql)
		if err != nil {
			log.Printf("migration %d failed: %v", i+1, err)
		} else {
			fmt.Printf("migration %d OK\n", i+1)
		}
	}
	fmt.Println("done")
}
