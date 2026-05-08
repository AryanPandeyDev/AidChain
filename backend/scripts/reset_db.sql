-- =============================================================================
-- AidChain Database Reset Script
-- Wipes ALL data from every table and resets to a clean state.
-- Schema (tables, indexes, constraints) is preserved.
--
-- Usage:
--   psql "YOUR_DATABASE_URL" -f scripts/reset_db.sql
-- =============================================================================

BEGIN;

-- Disable FK checks by truncating in dependency order (leaves → roots)
-- TRUNCATE CASCADE handles this automatically, but explicit ordering is clearer.

TRUNCATE TABLE trust_score_logs        CASCADE;
TRUNCATE TABLE proof_submissions       CASCADE;
TRUNCATE TABLE donations               CASCADE;
TRUNCATE TABLE pool_ngo_assignments    CASCADE;
TRUNCATE TABLE pool_assignment_requests CASCADE;
TRUNCATE TABLE crisis_pools            CASCADE;
TRUNCATE TABLE ngo_applications        CASCADE;
TRUNCATE TABLE event_sync_cursor       CASCADE;

-- Users are truncated last since everything references them.
-- NOTE: This will also wipe YOUR user record. You'll be re-provisioned
-- on next sign-in via the Clerk webhook.
TRUNCATE TABLE users                   CASCADE;

-- Re-seed the singleton event cursor row
INSERT INTO event_sync_cursor (last_block) VALUES (0);

COMMIT;

-- Confirm
SELECT 'Database reset complete. All tables are empty.' AS status;
