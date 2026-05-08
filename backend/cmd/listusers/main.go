package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		fmt.Println("connect error:", err)
		return
	}
	defer pool.Close()

	rows, err := pool.Query(context.Background(), "SELECT id, email, role, clerk_id FROM users ORDER BY created_at")
	if err != nil {
		fmt.Println("query error:", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, email, role string
		var clerkID *string
		_ = rows.Scan(&id, &email, &role, &clerkID)
		cid := "<none>"
		if clerkID != nil {
			cid = *clerkID
		}
		fmt.Printf("%s | %s | %s | clerk=%s\n", id, email, role, cid)
		count++
	}
	if count == 0 {
		fmt.Println("(no users in database)")
	} else {
		fmt.Printf("\nTotal: %d users\n", count)
	}
}
