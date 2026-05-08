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
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	_, err = pool.Exec(context.Background(), "ALTER TABLE crisis_pools ALTER COLUMN created_by SET NOT NULL")
	if err != nil {
		log.Fatalf("alter failed: %v", err)
	}
	fmt.Println("✅ crisis_pools.created_by is NOT NULL again")
}
