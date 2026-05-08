package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/user"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

// Promotes a user to ADMIN role by email address.
// This is the ONLY way to create an admin — the public API blocks it.
//
// Usage:
//   go run ./cmd/makeadmin <email>
//
// Example:
//   go run ./cmd/makeadmin aryan@aidchain.org

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run ./cmd/makeadmin <email>")
		os.Exit(1)
	}
	email := os.Args[1]

	_ = godotenv.Load()
	clerk.SetKey(os.Getenv("CLERK_SECRET_KEY"))

	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal("db connect:", err)
	}
	defer pool.Close()

	// 1. Update role in the database
	var dbUserID, clerkID, name string
	err = pool.QueryRow(context.Background(),
		`UPDATE users SET role = 'ADMIN' WHERE email = $1
		 RETURNING id, clerk_id, name`,
		email,
	).Scan(&dbUserID, &clerkID, &name)
	if err != nil {
		log.Fatalf("User '%s' not found in DB. Make sure they've signed in at least once.\nError: %v", email, err)
	}

	fmt.Printf("DB updated:  %s (%s) → ADMIN\n", name, email)

	// 2. Update Clerk publicMetadata so the frontend picks it up
	if clerkID != "" {
		meta := map[string]any{"db_user_id": dbUserID, "role": "ADMIN"}
		metaJSON, _ := json.Marshal(meta)
		if _, err := user.Update(context.Background(), clerkID, &user.UpdateParams{
			PublicMetadata: clerk.JSONRawMessage(metaJSON),
		}); err != nil {
			fmt.Printf("⚠️  Clerk metadata update failed: %v\n", err)
			fmt.Println("   The DB role is set. The user may need to sign out and back in.")
		} else {
			fmt.Printf("Clerk updated: publicMetadata.role = ADMIN\n")
		}
	}

	fmt.Println("\n✅ Done. This user now has admin access.")
}
